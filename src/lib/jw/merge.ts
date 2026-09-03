/**
 * JW Sync v3 — Core Multi-Database Merge Engine
 * 100% Client-Side SQLite Merge using WebAssembly (sql.js).
 * 
 * Rules:
 * - Tolerates benign foreign key violations (no PRAGMA foreign_keys = ON)
 * - MepsLanguage=0 for personal notes, NULL for study questions (InputField)
 * - Exact duplicate note resolution (text + anchor)
 * - Tag re-mapping and deduplication
 * - UserMark & BlockRange highlight merging with color remapping
 * - Recomputes SHA-256 hash and updates manifest.json
 */

import { Database } from 'sql.js';
import {
  IManifest,
  IMergeOptions,
  IMergeProgress,
  TagManagerMap,
  ILocation,
  INote,
  IUserMark,
  IBlockRange,
  ITag,
  ITagMap,
  IBookmark,
  IInputField,
} from './types';
import {
  openDatabase,
  queryAll,
  queryOne,
  execute,
  tableExists,
  columnExists,
  exportDatabase,
} from './sqlite';
import { createOrUpdateManifest } from './manifest';
import { packageJwLibrary } from './zip';
import { runHealthChecks, applyHealthFix } from './doctor';

export interface IMergeResult {
  mergedBlob: Blob;
  mergedDbBytes: Uint8Array;
  manifest: IManifest;
  stats: {
    notesAdded: number;
    notesMerged: number;
    marksAdded: number;
    tagsAdded: number;
    bookmarksAdded: number;
    inputFieldsAdded: number;
  };
  previewNotes: Array<{
    title: string;
    content: string;
    source: string;
  }>;
}

export async function mergeJwLibraries(
  primaryDbBytes: Uint8Array,
  primaryManifest: IManifest,
  secondaryFiles: Array<{
    name: string;
    dbBytes: Uint8Array;
    manifest: IManifest;
    extraFiles?: Map<string, Uint8Array>;
  }>,
  options: IMergeOptions = {},
  tagManager: TagManagerMap = {},
  onProgress?: (progress: IMergeProgress) => void,
  primaryExtraFiles?: Map<string, Uint8Array>
): Promise<IMergeResult> {
  const stats = {
    notesAdded: 0,
    notesMerged: 0,
    marksAdded: 0,
    tagsAdded: 0,
    bookmarksAdded: 0,
    inputFieldsAdded: 0,
  };
  const previewNotes: Array<{ title: string; content: string; source: string }> = [];

  onProgress?.({
    current: 1,
    total: 10,
    stage: 'Opening primary database...',
    details: primaryManifest.name || 'Primary Library',
  });

  const mainDb = await openDatabase(primaryDbBytes);

  // Disable aggressive foreign key enforcement to safely handle JW Library's benign FK anomalies
  try {
    mainDb.run('PRAGMA foreign_keys = OFF;');
  } catch (_) {}

  // Helper for generating UUIDs
  const generateGuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'jwsync-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  };

  const totalSecondaries = secondaryFiles.length;

  for (let sIdx = 0; sIdx < totalSecondaries; sIdx++) {
    const sec = secondaryFiles[sIdx];
    const secName = sec.name || `Secondary #${sIdx + 1}`;

    onProgress?.({
      current: 2 + sIdx * 3,
      total: 10,
      stage: `Processing library (${sIdx + 1}/${totalSecondaries})...`,
      details: secName,
    });

    const secDb = await openDatabase(sec.dbBytes);

    // ── 1. Map & Merge Locations ───────────────────────────────────────────
    const locationMap = new Map<number, number>(); // secLocId -> mainLocId

    if (tableExists(secDb, 'Location') && tableExists(mainDb, 'Location')) {
      const secLocations = queryAll<ILocation>(secDb, 'SELECT * FROM Location');

      for (const loc of secLocations) {
        // Find matching location in mainDb based on UNIQUE constraint and type attributes
        const findSql = `
          SELECT LocationId FROM Location 
          WHERE IFNULL(BookNumber, -1) = :book
            AND IFNULL(ChapterNumber, -1) = :chap
            AND IFNULL(KeySymbol, '') = :key
            AND IFNULL(MepsLanguage, -1) = :meps
            AND IFNULL(Type, 0) = :type
            AND (
              (:type = 0 AND IFNULL(DocumentId, -1) = :doc AND IFNULL(Track, -1) = :track AND IFNULL(IssueTagNumber, 0) = :issue)
              OR (:type != 0)
            )
          LIMIT 1
        `;

        const match = queryOne<{ LocationId: number }>(mainDb, findSql, {
          ':book': loc.BookNumber ?? -1,
          ':chap': loc.ChapterNumber ?? -1,
          ':key': loc.KeySymbol ?? '',
          ':meps': loc.MepsLanguage ?? -1,
          ':type': loc.Type ?? 0,
          ':doc': loc.DocumentId ?? -1,
          ':track': loc.Track ?? -1,
          ':issue': loc.IssueTagNumber ?? 0,
        });

        if (match) {
          locationMap.set(loc.LocationId, match.LocationId);
        } else {
          // Insert new location into mainDb
          execute(
            mainDb,
            `INSERT INTO Location (BookNumber, ChapterNumber, DocumentId, Track, IssueTagNumber, KeySymbol, MepsLanguage, Type, Title)
             VALUES (:b, :c, :d, :tr, :i, :k, :m, :ty, :t)`,
            {
              ':b': loc.BookNumber ?? null,
              ':c': loc.ChapterNumber ?? null,
              ':d': loc.DocumentId ?? null,
              ':tr': loc.Track ?? null,
              ':i': loc.IssueTagNumber ?? 0,
              ':k': loc.KeySymbol ?? null,
              ':m': loc.MepsLanguage ?? null,
              ':ty': loc.Type ?? 0,
              ':t': loc.Title ?? null,
            }
          );
          const newIdRow = queryOne<{ id: number }>(mainDb, 'SELECT last_insert_rowid() AS id');
          if (newIdRow) {
            locationMap.set(loc.LocationId, newIdRow.id);
          }
        }
      }
    }

    // ── 2. Map & Merge Tags ────────────────────────────────────────────────
    const tagMap = new Map<number, number>(); // secTagId -> mainTagId

    if (tableExists(secDb, 'Tag') && tableExists(mainDb, 'Tag')) {
      const secTags = queryAll<ITag>(secDb, 'SELECT * FROM Tag');

      for (const tag of secTags) {
        let finalTagName = tag.Name;
        const rule = tagManager[tag.Name];

        if (rule) {
          if (rule.action === 'merge' && rule.targetName) {
            finalTagName = rule.targetName;
          } else if (rule.action === 'rename' && rule.customName?.trim()) {
            finalTagName = rule.customName.trim();
          }
        }

        const match = queryOne<{ TagId: number }>(
          mainDb,
          'SELECT TagId FROM Tag WHERE Name = :name COLLATE NOCASE LIMIT 1',
          { ':name': finalTagName }
        );

        if (match) {
          tagMap.set(tag.TagId, match.TagId);
        } else {
          execute(
            mainDb,
            'INSERT INTO Tag (Type, Name) VALUES (:type, :name)',
            { ':type': tag.Type ?? 1, ':name': finalTagName }
          );
          const newIdRow = queryOne<{ id: number }>(mainDb, 'SELECT last_insert_rowid() AS id');
          if (newIdRow) {
            tagMap.set(tag.TagId, newIdRow.id);
            stats.tagsAdded++;
          }
        }
      }
    }

    // ── 3. Map & Merge UserMark & BlockRange (Highlights) ──────────────────
    const userMarkMap = new Map<number, number>(); // secUserMarkId -> mainUserMarkId

    if (
      tableExists(secDb, 'UserMark') &&
      tableExists(mainDb, 'UserMark') &&
      tableExists(secDb, 'BlockRange') &&
      tableExists(mainDb, 'BlockRange')
    ) {
      const secMarks = queryAll<IUserMark>(secDb, 'SELECT * FROM UserMark');

      for (const mark of secMarks) {
        const mappedLocId = mark.LocationId ? locationMap.get(mark.LocationId) : null;
        if (!mappedLocId) continue;

        // Apply color rule if configured
        let finalColorIndex = mark.ColorIndex;
        if (options.colorRules && options.colorRules[mark.ColorIndex] !== undefined) {
          finalColorIndex = options.colorRules[mark.ColorIndex];
        }

        // Check associated block ranges
        const secRanges = queryAll<IBlockRange>(
          secDb,
          'SELECT * FROM BlockRange WHERE UserMarkId = :uid',
          { ':uid': mark.UserMarkId }
        );

        // Check if an identical highlight exists in mainDb
        let existingMainMarkId: number | null = null;
        if (secRanges.length > 0) {
          const firstRange = secRanges[0];
          const matchMark = queryOne<{ UserMarkId: number }>(
            mainDb,
            `SELECT um.UserMarkId FROM UserMark um
             JOIN BlockRange br ON um.UserMarkId = br.UserMarkId
             WHERE um.LocationId = :loc 
               AND br.Identifier = :ident 
               AND br.StartToken = :st 
               AND br.EndToken = :et
             LIMIT 1`,
            {
              ':loc': mappedLocId,
              ':ident': firstRange.Identifier,
              ':st': firstRange.StartToken,
              ':et': firstRange.EndToken,
            }
          );
          if (matchMark) {
            existingMainMarkId = matchMark.UserMarkId;
          }
        }

        if (existingMainMarkId) {
          userMarkMap.set(mark.UserMarkId, existingMainMarkId);
        } else {
          // Check GUID collision
          const guidExists = queryOne<{ c: number }>(
            mainDb,
            'SELECT COUNT(*) AS c FROM UserMark WHERE UserMarkGuid = :guid',
            { ':guid': mark.UserMarkGuid }
          );
          const finalGuid =
            guidExists && guidExists.c > 0 ? generateGuid() : mark.UserMarkGuid;

          execute(
            mainDb,
            `INSERT INTO UserMark (ColorIndex, LocationId, StyleIndex, UserMarkGuid, Version)
             VALUES (:col, :loc, :sty, :guid, :ver)`,
            {
              ':col': finalColorIndex,
              ':loc': mappedLocId,
              ':sty': mark.StyleIndex ?? 0,
              ':guid': finalGuid,
              ':ver': mark.Version ?? 1,
            }
          );
          const newMarkRow = queryOne<{ id: number }>(
            mainDb,
            'SELECT last_insert_rowid() AS id'
          );
          if (newMarkRow) {
            const newMarkId = newMarkRow.id;
            userMarkMap.set(mark.UserMarkId, newMarkId);
            stats.marksAdded++;

            // Insert associated block ranges
            for (const br of secRanges) {
              execute(
                mainDb,
                `INSERT INTO BlockRange (BlockType, Identifier, StartToken, EndToken, UserMarkId)
                 VALUES (:bt, :id, :st, :et, :uid)`,
                {
                  ':bt': br.BlockType,
                  ':id': br.Identifier,
                  ':st': br.StartToken,
                  ':et': br.EndToken,
                  ':uid': newMarkId,
                }
              );
            }
          }
        }
      }
    }

    // ── 4. Map & Merge Notes ───────────────────────────────────────────────
    const noteMap = new Map<number, number>(); // secNoteId -> mainNoteId

    if (tableExists(secDb, 'Note') && tableExists(mainDb, 'Note')) {
      const secNotes = queryAll<INote>(secDb, 'SELECT * FROM Note');

      for (const note of secNotes) {
        const mappedLocId = note.LocationId ? locationMap.get(note.LocationId) ?? null : null;
        const mappedMarkId = note.UserMarkId ? userMarkMap.get(note.UserMarkId) ?? null : null;

        const hasBt = columnExists(mainDb, 'Note', 'BlockType');
        const hasBi = columnExists(mainDb, 'Note', 'BlockIdentifier');

        const btClause = hasBt ? 'AND IFNULL(BlockType, -1) = :bt' : '';
        const biClause = hasBi ? 'AND IFNULL(BlockIdentifier, -1) = :bi' : '';

        // Duplicate Check: Same trimmed Title, Content, and Anchor
        const dupMatch = queryOne<{ NoteId: number }>(
          mainDb,
          `SELECT NoteId FROM Note 
           WHERE TRIM(IFNULL(Title, '')) = :t 
             AND TRIM(IFNULL(Content, '')) = :c 
             AND IFNULL(LocationId, -1) = :l
             ${btClause}
             ${biClause}
           LIMIT 1`,
          {
            ':t': (note.Title || '').trim(),
            ':c': (note.Content || '').trim(),
            ':l': mappedLocId ?? -1,
            ...(hasBt ? { ':bt': note.BlockType ?? -1 } : {}),
            ...(hasBi ? { ':bi': note.BlockIdentifier ?? -1 } : {}),
          }
        );

        if (dupMatch) {
          noteMap.set(note.NoteId, dupMatch.NoteId);
          stats.notesMerged++;
        } else {
          // Respect explicit conflict resolution if configured
          const conflictChoice = options.conflictResolutions?.[note.Guid];
          if (conflictChoice === 'a') {
            // Discard secondary note, keep primary
            continue;
          }
          if (conflictChoice === 'b') {
            // Overwrite primary with secondary
            const existingInMain = queryOne<{ NoteId: number }>(mainDb, 'SELECT NoteId FROM Note WHERE Guid = :guid', { ':guid': note.Guid });
            if (existingInMain) {
              execute(mainDb, 'UPDATE Note SET Content = :c, Title = :t, LastModified = :lm WHERE NoteId = :id', {
                ':c': note.Content ?? null,
                ':t': note.Title ?? null,
                ':lm': note.LastModified || new Date().toISOString(),
                ':id': existingInMain.NoteId,
              });
              noteMap.set(note.NoteId, existingInMain.NoteId);
              stats.notesMerged++;
              continue;
            }
          }

          // Check GUID collision
          const guidExists = queryOne<{ c: number }>(
            mainDb,
            'SELECT COUNT(*) AS c FROM Note WHERE Guid = :guid',
            { ':guid': note.Guid }
          );
          const finalGuid =
            guidExists && guidExists.c > 0 ? generateGuid() : note.Guid;

          execute(
            mainDb,
            `INSERT INTO Note (Guid, UserMarkId, LocationId, Title, Content, LastModified, Created, BlockType, BlockIdentifier)
             VALUES (:g, :um, :loc, :t, :c, :lm, :cr, :bt, :bi)`,
            {
              ':g': finalGuid,
              ':um': mappedMarkId,
              ':loc': mappedLocId,
              ':t': note.Title ?? null,
              ':c': note.Content ?? null,
              ':lm': note.LastModified || new Date().toISOString(),
              ':cr': note.Created || new Date().toISOString(),
              ':bt': note.BlockType ?? 0,
              ':bi': note.BlockType === 0 ? null : (note.BlockIdentifier ?? null),
            }
          );

          const newNoteRow = queryOne<{ id: number }>(
            mainDb,
            'SELECT last_insert_rowid() AS id'
          );
          if (newNoteRow) {
            noteMap.set(note.NoteId, newNoteRow.id);
            stats.notesAdded++;

            if (previewNotes.length < 5) {
              previewNotes.push({
                title: note.Title || '(Untitled Note)',
                content: (note.Content || '').slice(0, 100),
                source: secName,
              });
            }
          }
        }
      }
    }

    // TagMap merge moved after playlists

    // ── 6. Merge Bookmarks ─────────────────────────────────────────────────
    if (tableExists(secDb, 'Bookmark') && tableExists(mainDb, 'Bookmark')) {
      const secBookmarks = queryAll<IBookmark>(secDb, 'SELECT * FROM Bookmark');

      for (const bm of secBookmarks) {
        const mappedLocId = locationMap.get(bm.LocationId);
        const mappedPubLocId = bm.PublicationLocationId
          ? locationMap.get(bm.PublicationLocationId) ?? mappedLocId
          : mappedLocId;

        if (!mappedLocId || !mappedPubLocId) continue;

        // Check if exact bookmark already exists on same location and slot
        const exactMatch = queryOne<{ BookmarkId: number }>(
          mainDb,
          `SELECT BookmarkId FROM Bookmark 
           WHERE LocationId = :lid AND PublicationLocationId = :plid AND Slot = :slot`,
          { ':lid': mappedLocId, ':plid': mappedPubLocId, ':slot': bm.Slot }
        );
        if (exactMatch) continue;

        // Check if slot on publication location is already occupied
        let targetSlot = bm.Slot;
        const slotTaken = queryOne<{ c: number }>(
          mainDb,
          `SELECT COUNT(*) AS c FROM Bookmark WHERE PublicationLocationId = :plid AND Slot = :slot`,
          { ':plid': mappedPubLocId, ':slot': targetSlot }
        );
        if (slotTaken && slotTaken.c > 0) {
          const nextSlotRow = queryOne<{ nextSlot: number }>(
            mainDb,
            `SELECT COALESCE(MAX(Slot), -1) + 1 AS nextSlot FROM Bookmark WHERE PublicationLocationId = :plid`,
            { ':plid': mappedPubLocId }
          );
          targetSlot = nextSlotRow ? nextSlotRow.nextSlot : 0;
        }

        const blockType = bm.BlockType ?? 0;
        const blockId = blockType === 0 ? null : (bm.BlockIdentifier ?? null);

        execute(
          mainDb,
          `INSERT INTO Bookmark (LocationId, PublicationLocationId, Slot, Title, Snippet, BlockType, BlockIdentifier)
           VALUES (:lid, :plid, :slot, :title, :snip, :bt, :bi)`,
          {
            ':lid': mappedLocId,
            ':plid': mappedPubLocId,
            ':slot': targetSlot,
            ':title': bm.Title ?? '',
            ':snip': bm.Snippet ?? null,
            ':bt': blockType,
            ':bi': blockId,
          }
        );
        stats.bookmarksAdded++;
      }
    }

    // ── 7. Merge InputFields (Study Answers) ───────────────────────────────
    if (tableExists(secDb, 'InputField') && tableExists(mainDb, 'InputField')) {
      const secInputs = queryAll<IInputField>(secDb, 'SELECT * FROM InputField');

      for (const inp of secInputs) {
        const mappedLocId = locationMap.get(inp.LocationId);
        if (!mappedLocId) continue;

        const existing = queryOne<IInputField>(
          mainDb,
          'SELECT Value FROM InputField WHERE LocationId = :lid AND TextTag = :tag LIMIT 1',
          { ':lid': mappedLocId, ':tag': inp.TextTag }
        );

        if (!existing) {
          execute(
            mainDb,
            'INSERT INTO InputField (LocationId, TextTag, Value) VALUES (:lid, :tag, :val)',
            { ':lid': mappedLocId, ':tag': inp.TextTag, ':val': inp.Value }
          );
          stats.inputFieldsAdded++;
        }
      }
    }

    // ── 8. Merge Playlists & Independent Media ─────────────────────────────
    const mediaMap = new Map<number, number>(); // secMediaId -> mainMediaId
    if (tableExists(secDb, 'IndependentMedia') && tableExists(mainDb, 'IndependentMedia')) {
      const secMedias = queryAll<any>(secDb, 'SELECT * FROM IndependentMedia');
      for (const media of secMedias) {
        const dup = queryOne<{ IndependentMediaId: number }>(
          mainDb,
          'SELECT IndependentMediaId FROM IndependentMedia WHERE Hash = :h AND FilePath = :f LIMIT 1',
          { ':h': media.Hash, ':f': media.FilePath }
        );
        if (dup) {
          mediaMap.set(media.IndependentMediaId, dup.IndependentMediaId);
        } else {
          execute(
            mainDb,
            'INSERT INTO IndependentMedia (OriginalFilename, FilePath, MimeType, Hash) VALUES (:o, :f, :m, :h)',
            { ':o': media.OriginalFilename, ':f': media.FilePath, ':m': media.MimeType, ':h': media.Hash }
          );
          const newIdRow = queryOne<{ id: number }>(mainDb, 'SELECT last_insert_rowid() AS id');
          if (newIdRow) mediaMap.set(media.IndependentMediaId, newIdRow.id);
        }
      }
    }

    const playlistMap = new Map<number, number>(); // secPlaylistItemId -> mainPlaylistItemId
    if (tableExists(secDb, 'PlaylistItem') && tableExists(mainDb, 'PlaylistItem')) {
      const secPlaylists = queryAll<any>(secDb, 'SELECT * FROM PlaylistItem');
      for (const pl of secPlaylists) {
        execute(
          mainDb,
          'INSERT INTO PlaylistItem (Label, StartTrimOffsetTicks, EndTrimOffsetTicks, Accuracy, EndAction, ThumbnailFilePath) VALUES (:l, :s, :e, :a, :ea, :t)',
          {
            ':l': pl.Label, ':s': pl.StartTrimOffsetTicks, ':e': pl.EndTrimOffsetTicks,
            ':a': pl.Accuracy, ':ea': pl.EndAction, ':t': pl.ThumbnailFilePath
          }
        );
        const newIdRow = queryOne<{ id: number }>(mainDb, 'SELECT last_insert_rowid() AS id');
        if (newIdRow) {
          playlistMap.set(pl.PlaylistItemId, newIdRow.id);

          // PlaylistItemIndependentMediaMap
          if (tableExists(secDb, 'PlaylistItemIndependentMediaMap') && tableExists(mainDb, 'PlaylistItemIndependentMediaMap')) {
            const secMediaMaps = queryAll<any>(secDb, 'SELECT * FROM PlaylistItemIndependentMediaMap WHERE PlaylistItemId = :pid', { ':pid': pl.PlaylistItemId });
            for (const mm of secMediaMaps) {
              const mappedMediaId = mediaMap.get(mm.IndependentMediaId);
              if (mappedMediaId) {
                execute(
                  mainDb,
                  'INSERT INTO PlaylistItemIndependentMediaMap (PlaylistItemId, IndependentMediaId, DurationTicks) VALUES (:pid, :mid, :d)',
                  { ':pid': newIdRow.id, ':mid': mappedMediaId, ':d': mm.DurationTicks }
                );
              }
            }
          }

          // PlaylistItemLocationMap
          if (tableExists(secDb, 'PlaylistItemLocationMap') && tableExists(mainDb, 'PlaylistItemLocationMap')) {
            const secLocMaps = queryAll<any>(secDb, 'SELECT * FROM PlaylistItemLocationMap WHERE PlaylistItemId = :pid', { ':pid': pl.PlaylistItemId });
            for (const lm of secLocMaps) {
              const mappedLocId = locationMap.get(lm.LocationId);
              if (mappedLocId) {
                execute(
                  mainDb,
                  'INSERT INTO PlaylistItemLocationMap (PlaylistItemId, LocationId, MajorMultimediaType, BaseDurationTicks) VALUES (:pid, :lid, :m, :b)',
                  { ':pid': newIdRow.id, ':lid': mappedLocId, ':m': lm.MajorMultimediaType, ':b': lm.BaseDurationTicks }
                );
              }
            }
          }

          // PlaylistItemMarker
          const markerMap = new Map<number, number>();
          if (tableExists(secDb, 'PlaylistItemMarker') && tableExists(mainDb, 'PlaylistItemMarker')) {
            const secMarkers = queryAll<any>(secDb, 'SELECT * FROM PlaylistItemMarker WHERE PlaylistItemId = :pid', { ':pid': pl.PlaylistItemId });
            for (const mk of secMarkers) {
              execute(
                mainDb,
                'INSERT INTO PlaylistItemMarker (PlaylistItemId, Label, StartTimeTicks, DurationTicks, EndTransitionDurationTicks) VALUES (:pid, :l, :s, :d, :e)',
                { ':pid': newIdRow.id, ':l': mk.Label, ':s': mk.StartTimeTicks, ':d': mk.DurationTicks, ':e': mk.EndTransitionDurationTicks }
              );
              const newMkRow = queryOne<{ id: number }>(mainDb, 'SELECT last_insert_rowid() AS id');
              if (newMkRow) markerMap.set(mk.PlaylistItemMarkerId, newMkRow.id);
            }
          }

          // PlaylistItemMarkerBibleVerseMap
          if (tableExists(secDb, 'PlaylistItemMarkerBibleVerseMap') && tableExists(mainDb, 'PlaylistItemMarkerBibleVerseMap')) {
            const secVerseMaps = queryAll<any>(secDb, 'SELECT * FROM PlaylistItemMarkerBibleVerseMap');
            for (const vm of secVerseMaps) {
              const mappedMkId = markerMap.get(vm.PlaylistItemMarkerId);
              if (mappedMkId) {
                execute(
                  mainDb,
                  'INSERT INTO PlaylistItemMarkerBibleVerseMap (PlaylistItemMarkerId, VerseId) VALUES (:mid, :vid)',
                  { ':mid': mappedMkId, ':vid': vm.VerseId }
                );
              }
            }
          }

          // PlaylistItemMarkerParagraphMap
          if (tableExists(secDb, 'PlaylistItemMarkerParagraphMap') && tableExists(mainDb, 'PlaylistItemMarkerParagraphMap')) {
            const secParaMaps = queryAll<any>(secDb, 'SELECT * FROM PlaylistItemMarkerParagraphMap');
            for (const pm of secParaMaps) {
              const mappedMkId = markerMap.get(pm.PlaylistItemMarkerId);
              if (mappedMkId) {
                execute(
                  mainDb,
                  'INSERT INTO PlaylistItemMarkerParagraphMap (PlaylistItemMarkerId, MepsDocumentId, ParagraphIndex, MarkerIndexWithinParagraph) VALUES (:mid, :meps, :pi, :mi)',
                  { ':mid': mappedMkId, ':meps': pm.MepsDocumentId, ':pi': pm.ParagraphIndex, ':mi': pm.MarkerIndexWithinParagraph }
                );
              }
            }
          }
        }
      }
    }

    // ── 9. Merge TagMap ────────────────────────────────────────────────────
    if (tableExists(secDb, 'TagMap') && tableExists(mainDb, 'TagMap')) {
      const secTagMaps = queryAll<ITagMap>(secDb, 'SELECT * FROM TagMap');

      for (const tm of secTagMaps) {
        const mappedTagId = tagMap.get(tm.TagId);
        const mappedNoteId = tm.NoteId ? noteMap.get(tm.NoteId) : null;
        const mappedLocId = tm.LocationId ? locationMap.get(tm.LocationId) : null;
        const mappedPlaylistId = tm.PlaylistItemId ? playlistMap.get(tm.PlaylistItemId) : null;

        // Validate exactly one target is present to fulfill TagMap CHECK constraint
        const hasNote = mappedNoteId !== null && mappedNoteId !== undefined;
        const hasLoc = mappedLocId !== null && mappedLocId !== undefined && !hasNote;
        const hasPl = !hasNote && !hasLoc && (mappedPlaylistId !== null && mappedPlaylistId !== undefined);

        if (!hasNote && !hasLoc && !hasPl) {
          continue; // Cannot insert TagMap entry with zero or ambiguous targets
        }

        const finalNoteId = hasNote ? mappedNoteId : null;
        const finalLocId = hasLoc ? mappedLocId : null;
        const finalPlaylistId = hasPl ? mappedPlaylistId : null;

        // Check if this tag mapping already exists in mainDb
        const exists = queryOne<{ c: number }>(
          mainDb,
          `SELECT COUNT(*) AS c FROM TagMap 
           WHERE TagId = :tid AND (
             (:nid IS NOT NULL AND NoteId = :nid) OR
             (:lid IS NOT NULL AND LocationId = :lid) OR
             (:plid IS NOT NULL AND PlaylistItemId = :plid)
           )`,
          {
            ':tid': mappedTagId,
            ':nid': finalNoteId,
            ':lid': finalLocId,
            ':plid': finalPlaylistId,
          }
        );

        if (!exists || exists.c === 0) {
          // Calculate next position for this tag to prevent UNIQUE(TagId, Position) violation
          const nextPosRow = queryOne<{ nextPos: number }>(
            mainDb,
            `SELECT COALESCE(MAX(Position), -1) + 1 AS nextPos FROM TagMap WHERE TagId = :tid`,
            { ':tid': mappedTagId }
          );
          const nextPos = nextPosRow ? nextPosRow.nextPos : 0;

          execute(
            mainDb,
            `INSERT INTO TagMap (PlaylistItemId, LocationId, NoteId, TagId, Position)
             VALUES (:pl, :loc, :nid, :tid, :pos)`,
            {
              ':pl': finalPlaylistId,
              ':loc': finalLocId,
              ':nid': finalNoteId,
              ':tid': mappedTagId,
              ':pos': nextPos,
            }
          );
        }
      }
    }

    secDb.close();
  }

  // ── 8. Optional Doctor Health Checks & Clean ─────────────────────────────
  if (options.doctorCheck) {
    onProgress?.({
      current: 8,
      total: 10,
      stage: 'Running Library Doctor diagnostics...',
    });
    const healthIssues = runHealthChecks(mainDb);
    for (const issue of healthIssues) {
      if (issue.count > 0 && issue.canFix) {
        applyHealthFix(mainDb, issue.key, issue.affectedIds);
      }
    }
  }

  // ── 9. Finalize Database & Create .jwlibrary Bundle ──────────────────────
  onProgress?.({
    current: 9,
    total: 10,
    stage: 'Finalizing database and computing SHA-256 hash...',
  });

  const mergedDbBytes = exportDatabase(mainDb);
  mainDb.close();

  const finalName = options.primaryName || `${primaryManifest.name || 'Library'} (Merged)`;
  const finalDevice = options.deviceName || 'JW Sync (Web)';

  const updatedManifest = await createOrUpdateManifest(
    mergedDbBytes,
    primaryManifest,
    { name: finalName, deviceName: finalDevice }
  );

  onProgress?.({
    current: 10,
    total: 10,
    stage: 'Packaging .jwlibrary archive...',
  });

  const mergedExtraFiles = new Map<string, Uint8Array>();
  if (primaryExtraFiles) {
    for (const [k, v] of primaryExtraFiles.entries()) mergedExtraFiles.set(k, v);
  }
  for (const sec of secondaryFiles) {
    if (sec.extraFiles) {
      for (const [k, v] of sec.extraFiles.entries()) mergedExtraFiles.set(k, v);
    }
  }

  const mergedBlob = await packageJwLibrary(mergedDbBytes, updatedManifest, mergedExtraFiles);

  return {
    mergedBlob,
    mergedDbBytes,
    manifest: updatedManifest,
    stats,
    previewNotes,
  };
}
