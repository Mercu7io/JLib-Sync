import type { Database } from 'sql.js';
import { queryAll } from './sqlite.ts';
import { BIBLE_BOOKS } from './locales.ts';

export interface IConflictItem {
  id: string;
  verseAnchor: string;
  sourceAText: string;
  sourceBText: string;
  choice: 'both' | 'a' | 'b';
}

interface IDbLocation {
  LocationId: number;
  BookNumber: number | null;
  ChapterNumber: number | null;
  DocumentId: number | null;
  Track: number | null;
  IssueTagNumber: number | null;
  KeySymbol: string | null;
  MepsLanguage: number | null;
  Type: number;
  Title: string | null;
}

interface IDbNote {
  NoteId: number;
  Guid: string;
  LocationId: number | null;
  BlockIdentifier: number | null;
  BlockType: number | null;
  Title: string | null;
  Content: string | null;
  LastModified: string | null;
}

function getCanonicalLocationKey(loc: IDbLocation): string {
  if (!loc) return 'unknown';
  if (loc.Type === 0) {
    return `doc_${loc.KeySymbol || ''}_${loc.MepsLanguage || 0}_${loc.DocumentId || -1}_${loc.IssueTagNumber || 0}_${loc.Track || -1}`;
  }
  return `bible_${loc.KeySymbol || ''}_${loc.MepsLanguage || 0}_${loc.BookNumber || -1}_${loc.ChapterNumber || -1}`;
}

function getLocationLabel(loc: IDbLocation | undefined, defaultTitle?: string | null): string {
  if (defaultTitle && defaultTitle.trim()) return defaultTitle.trim();
  if (!loc) return 'Personal Note';
  if (loc.Title && loc.Title.trim()) return loc.Title.trim();
  if (loc.BookNumber && loc.BookNumber > 0) {
    const bookName = BIBLE_BOOKS[loc.BookNumber] || `Book #${loc.BookNumber}`;
    return loc.ChapterNumber ? `${bookName} ${loc.ChapterNumber}` : bookName;
  }
  if (loc.KeySymbol) {
    return loc.IssueTagNumber ? `${loc.KeySymbol} (${loc.IssueTagNumber})` : loc.KeySymbol;
  }
  return `Document #${loc.DocumentId || loc.LocationId}`;
}

/**
 * Intelligent Conflict Detection for JW Library Personal Study Notes:
 * - Canonical location resolution (matches verses across independent SQLite files)
 * - Eliminates identical notes regardless of listing order
 * - Guarantees ZERO duplicate pairs (each pair reported at most once)
 * - Identifies true collisions (same GUID edited differently, or same title on same paragraph)
 */
export function detectRealConflicts(dbA: Database, dbB: Database): IConflictItem[] {
  // 1. Load Locations
  const locsA = queryAll<IDbLocation>(dbA, 'SELECT * FROM Location');
  const locsB = queryAll<IDbLocation>(dbB, 'SELECT * FROM Location');

  const locMapA = new Map<number, { key: string; label: string }>();
  locsA.forEach((l) => {
    locMapA.set(l.LocationId, {
      key: getCanonicalLocationKey(l),
      label: getLocationLabel(l),
    });
  });

  const locMapB = new Map<number, { key: string; label: string }>();
  locsB.forEach((l) => {
    locMapB.set(l.LocationId, {
      key: getCanonicalLocationKey(l),
      label: getLocationLabel(l),
    });
  });

  // 2. Load Notes with non-empty content or title
  const rawNotesA = queryAll<IDbNote>(
    dbA,
    `SELECT NoteId, Guid, LocationId, BlockIdentifier, BlockType, Title, Content, LastModified 
     FROM Note 
     WHERE (Content IS NOT NULL AND length(trim(Content)) > 0) 
        OR (Title IS NOT NULL AND length(trim(Title)) > 0)`
  );
  const rawNotesB = queryAll<IDbNote>(
    dbB,
    `SELECT NoteId, Guid, LocationId, BlockIdentifier, BlockType, Title, Content, LastModified 
     FROM Note 
     WHERE (Content IS NOT NULL AND length(trim(Content)) > 0) 
        OR (Title IS NOT NULL AND length(trim(Title)) > 0)`
  );

  const detected: IConflictItem[] = [];
  const handledA = new Set<number>();
  const handledB = new Set<number>();
  const seenConflictPairs = new Set<string>();

  // 3. First pass: Match identical notes across the databases
  // If a note in A has the same canonical location, block, and exact same (Title + Content) in B,
  // it is already synchronized and identical! NOT a conflict.
  for (const nA of rawNotesA) {
    const locInfoA = nA.LocationId ? locMapA.get(nA.LocationId) : null;
    const normContentA = (nA.Content || '').trim();
    const normTitleA = (nA.Title || '').trim();
    const anchorA = `${locInfoA?.key || 'unknown'}_${nA.BlockType ?? 0}_${nA.BlockIdentifier ?? 0}`;

    for (const nB of rawNotesB) {
      if (handledB.has(nB.NoteId)) continue;
      const locInfoB = nB.LocationId ? locMapB.get(nB.LocationId) : null;
      const normContentB = (nB.Content || '').trim();
      const normTitleB = (nB.Title || '').trim();
      const anchorB = `${locInfoB?.key || 'unknown'}_${nB.BlockType ?? 0}_${nB.BlockIdentifier ?? 0}`;

      // Same anchor and same content -> EXACT MATCH
      if (anchorA === anchorB && normContentA === normContentB && normTitleA === normTitleB) {
        handledA.add(nA.NoteId);
        handledB.add(nB.NoteId);
        break;
      }
    }
  }

  // 4. Second pass: Check GUID collisions for remaining notes (case-insensitive)
  // If a note has the exact same GUID on both devices but DIFFERENT content or title:
  // this is a true note edition collision!
  const guidMapB = new Map<string, IDbNote>();
  rawNotesB.forEach((n) => {
    if (!handledB.has(n.NoteId) && n.Guid) {
      guidMapB.set(n.Guid.trim().toLowerCase(), n);
    }
  });

  for (const nA of rawNotesA) {
    if (handledA.has(nA.NoteId) || !nA.Guid) continue;
    const cleanGuidA = nA.Guid.trim().toLowerCase();
    const matchB = guidMapB.get(cleanGuidA);
    if (matchB) {
      const pairKey = `guid_${cleanGuidA}`;
      if (!seenConflictPairs.has(pairKey)) {
        seenConflictPairs.add(pairKey);
        handledA.add(nA.NoteId);
        handledB.add(matchB.NoteId);

        const locA = nA.LocationId ? locMapA.get(nA.LocationId) : null;
        const locB = matchB.LocationId ? locMapB.get(matchB.LocationId) : null;
        const anchorLabel = locA?.label || locB?.label || nA.Title || matchB.Title || 'Study Note';

        const textA = [nA.Title?.trim(), nA.Content?.trim()].filter(Boolean).join(' — ');
        const textB = [matchB.Title?.trim(), matchB.Content?.trim()].filter(Boolean).join(' — ');

        detected.push({
          id: nA.Guid,
          verseAnchor: anchorLabel,
          sourceAText: textA || nA.Content || '',
          sourceBText: textB || matchB.Content || '',
          choice: 'both',
        });
      }
    }
  }

  // 5. Third pass: Remaining unmatched notes sharing the same anchor
  const remainingA = rawNotesA.filter((n) => !handledA.has(n.NoteId));
  const remainingB = rawNotesB.filter((n) => !handledB.has(n.NoteId));

  for (const nA of remainingA) {
    if (handledA.has(nA.NoteId)) continue;
    const locInfoA = nA.LocationId ? locMapA.get(nA.LocationId) : null;
    const normTitleA = (nA.Title || '').trim().toLowerCase();
    const anchorA = `${locInfoA?.key || 'unknown'}_${nA.BlockType ?? 0}_${nA.BlockIdentifier ?? 0}`;
    if (anchorA === 'unknown_0_0' && !normTitleA) {
      // Independent note with no anchor and no title: cannot safely match across devices
      continue;
    }

    for (const nB of remainingB) {
      if (handledB.has(nB.NoteId)) continue;
      const locInfoB = nB.LocationId ? locMapB.get(nB.LocationId) : null;
      const normTitleB = (nB.Title || '').trim().toLowerCase();
      const anchorB = `${locInfoB?.key || 'unknown'}_${nB.BlockType ?? 0}_${nB.BlockIdentifier ?? 0}`;

      // Match if same anchor on verse/publication or same non-empty title
      const isSameAnchor = anchorA === anchorB && anchorA !== 'unknown_0_0';
      const isSameTitle = normTitleA && normTitleB && normTitleA === normTitleB;

      if (isSameAnchor || isSameTitle) {
        const pairKey = `pair_${nA.NoteId}_${nB.NoteId}`;
        if (!seenConflictPairs.has(pairKey)) {
          seenConflictPairs.add(pairKey);
          handledA.add(nA.NoteId);
          handledB.add(nB.NoteId);

          const textA = [nA.Title?.trim(), nA.Content?.trim()].filter(Boolean).join(' — ');
          const textB = [nB.Title?.trim(), nB.Content?.trim()].filter(Boolean).join(' — ');

          detected.push({
            id: nA.Guid || `${nA.NoteId}_${nB.NoteId}`,
            verseAnchor: locInfoA?.label || locInfoB?.label || nA.Title || nB.Title || 'Study Note',
            sourceAText: textA || nA.Content || '',
            sourceBText: textB || nB.Content || '',
            choice: 'both',
          });
        }
        break;
      }
    }
  }

  return detected;
}
