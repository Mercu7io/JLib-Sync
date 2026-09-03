/**
 * JW Sync v3 — Library Doctor & Health Diagnostics
 * Headless diagnostics to identify and safely repair common database inconsistencies:
 * - Duplicate notes on same anchor
 * - Empty notes
 * - Orphaned block ranges
 * - Orphaned tag maps
 * - Unused tags
 * - Unused locations
 */

import { Database } from 'sql.js';
import { IHealthCheckResult } from './types';
import { tableExists, columnExists, queryAll, execute } from './sqlite';

export function runHealthChecks(db: Database): IHealthCheckResult[] {
  const results: IHealthCheckResult[] = [];

  // 1. Duplicate Notes
  if (tableExists(db, 'Note')) {
    const bt = columnExists(db, 'Note', 'BlockType') ? 'IFNULL(BlockType,-1)' : '-1';
    const bi = columnExists(db, 'Note', 'BlockIdentifier') ? 'IFNULL(BlockIdentifier,-1)' : '-1';
    const btN = columnExists(db, 'Note', 'BlockType') ? 'IFNULL(n.BlockType,-1)' : '-1';
    const biN = columnExists(db, 'Note', 'BlockIdentifier') ? 'IFNULL(n.BlockIdentifier,-1)' : '-1';
    const keepCol = columnExists(db, 'Note', 'UserMarkId')
      ? 'COALESCE(MIN(CASE WHEN UserMarkId IS NOT NULL THEN NoteId END), MIN(NoteId))'
      : 'MIN(NoteId)';

    const sql = `
      SELECT n.NoteId AS dup, g.keepId AS keep
      FROM Note n
      JOIN (
        SELECT IFNULL(Title,'') AS t, IFNULL(Content,'') AS c, IFNULL(LocationId,-1) AS l,
               ${bt} AS bt, ${bi} AS bi, ${keepCol} AS keepId
        FROM Note
        WHERE (TRIM(IFNULL(Title,'')) <> '' OR TRIM(IFNULL(Content,'')) <> '')
        GROUP BY t, c, l, bt, bi
        HAVING COUNT(*) > 1
      ) g ON IFNULL(n.Title,'') = g.t AND IFNULL(n.Content,'') = g.c 
         AND IFNULL(n.LocationId,-1) = g.l AND ${btN} = g.bt AND ${biN} = g.bi
      WHERE n.NoteId <> g.keepId
    `;

    const dupRows = queryAll<{ dup: number; keep: number }>(db, sql);
    results.push({
      key: 'dup_notes',
      label: 'Duplicate Notes',
      count: dupRows.length,
      description: 'Identical notes on the exact same scripture or paragraph anchor.',
      canFix: true,
      affectedIds: dupRows.map((r) => r.dup),
    });
  }

  // 2. Empty Notes
  if (tableExists(db, 'Note')) {
    const sql = `
      SELECT NoteId FROM Note 
      WHERE TRIM(IFNULL(Title,'')) = '' AND TRIM(IFNULL(Content,'')) = ''
    `;
    const emptyNotes = queryAll<{ NoteId: number }>(db, sql);
    results.push({
      key: 'empty_notes',
      label: 'Empty Notes',
      count: emptyNotes.length,
      description: 'Notes containing neither title nor text.',
      canFix: true,
      affectedIds: emptyNotes.map((r) => r.NoteId),
    });
  }

  // 3. Orphaned BlockRanges
  if (tableExists(db, 'BlockRange') && tableExists(db, 'UserMark')) {
    const sql = `
      SELECT br.BlockRangeId 
      FROM BlockRange br 
      LEFT JOIN UserMark um ON br.UserMarkId = um.UserMarkId 
      WHERE um.UserMarkId IS NULL
    `;
    const orphanRanges = queryAll<{ BlockRangeId: number }>(db, sql);
    results.push({
      key: 'orph_br',
      label: 'Orphaned Highlight Ranges',
      count: orphanRanges.length,
      description: 'Highlight block positions whose parent mark was removed.',
      canFix: true,
      affectedIds: orphanRanges.map((r) => r.BlockRangeId),
    });
  }

  // 4. Orphaned TagMap Entries
  if (tableExists(db, 'TagMap') && tableExists(db, 'Note') && tableExists(db, 'Tag')) {
    const sql = `
      SELECT tm.TagMapId 
      FROM TagMap tm 
      LEFT JOIN Note n ON tm.NoteId = n.NoteId 
      LEFT JOIN Tag t ON tm.TagId = t.TagId 
      WHERE (tm.NoteId IS NOT NULL AND n.NoteId IS NULL) OR t.TagId IS NULL
    `;
    const orphanTags = queryAll<{ TagMapId: number }>(db, sql);
    results.push({
      key: 'orph_tm',
      label: 'Broken Tag Associations',
      count: orphanTags.length,
      description: 'Tags pointing to deleted notes or missing tag definitions.',
      canFix: true,
      affectedIds: orphanTags.map((r) => r.TagMapId),
    });
  }

  // 5. Unused Tags (Only user tags Type = 1; playlists Type = 2 and system tags Type = 0 must be preserved)
  if (tableExists(db, 'Tag') && tableExists(db, 'TagMap')) {
    const sql = `
      SELECT t.TagId 
      FROM Tag t 
      LEFT JOIN TagMap tm ON t.TagId = tm.TagId 
      WHERE t.Type = 1 AND tm.TagMapId IS NULL
    `;
    const unusedTags = queryAll<{ TagId: number }>(db, sql);
    results.push({
      key: 'unused_tags',
      label: 'Unused Tags',
      count: unusedTags.length,
      description: 'Study tags with zero attached notes or scriptures.',
      canFix: true,
      affectedIds: unusedTags.map((r) => r.TagId),
    });
  }

  // 6. Unused Locations
  if (tableExists(db, 'Location')) {
    const hasNotes = tableExists(db, 'Note');
    const hasMarks = tableExists(db, 'UserMark');
    const hasBookmarks = tableExists(db, 'Bookmark');
    const hasPlaylistLocs = tableExists(db, 'PlaylistItemLocationMap');
    const hasTagMap = tableExists(db, 'TagMap');
    const hasInputs = tableExists(db, 'InputField');

    const sql = `
      SELECT l.LocationId 
      FROM Location l
      ${hasNotes ? 'LEFT JOIN Note n ON l.LocationId = n.LocationId' : ''}
      ${hasMarks ? 'LEFT JOIN UserMark um ON l.LocationId = um.LocationId' : ''}
      ${hasBookmarks ? 'LEFT JOIN Bookmark bm ON l.LocationId = bm.LocationId' : ''}
      ${hasBookmarks ? 'LEFT JOIN Bookmark bmPub ON l.LocationId = bmPub.PublicationLocationId' : ''}
      ${hasPlaylistLocs ? 'LEFT JOIN PlaylistItemLocationMap plm ON l.LocationId = plm.LocationId' : ''}
      ${hasTagMap ? 'LEFT JOIN TagMap tm ON l.LocationId = tm.LocationId' : ''}
      ${hasInputs ? 'LEFT JOIN InputField inp ON l.LocationId = inp.LocationId' : ''}
      WHERE 1=1
      ${hasNotes ? 'AND n.NoteId IS NULL' : ''}
      ${hasMarks ? 'AND um.UserMarkId IS NULL' : ''}
      ${hasBookmarks ? 'AND bm.BookmarkId IS NULL AND bmPub.BookmarkId IS NULL' : ''}
      ${hasPlaylistLocs ? 'AND plm.LocationId IS NULL' : ''}
      ${hasTagMap ? 'AND tm.TagMapId IS NULL' : ''}
      ${hasInputs ? 'AND inp.LocationId IS NULL' : ''}
    `;
    const unusedLocs = queryAll<{ LocationId: number }>(db, sql);
    results.push({
      key: 'unused_loc',
      label: 'Unreferenced Locations',
      count: unusedLocs.length,
      description: 'Document references no longer tied to any study entry.',
      canFix: true,
      affectedIds: unusedLocs.map((r) => r.LocationId),
    });
  }

  return results;
}

/**
 * Safely applies repairs for a specific health check.
 */
export function applyHealthFix(
  db: Database,
  checkKey: string,
  affectedIds: number[]
): number {
  if (!affectedIds || affectedIds.length === 0) return 0;

  const idList = affectedIds.join(',');

  switch (checkKey) {
    case 'dup_notes':
    case 'empty_notes':
      if (tableExists(db, 'TagMap')) {
        execute(db, `DELETE FROM TagMap WHERE NoteId IN (${idList})`);
      }
      execute(db, `DELETE FROM Note WHERE NoteId IN (${idList})`);
      return affectedIds.length;

    case 'orph_br':
      execute(db, `DELETE FROM BlockRange WHERE BlockRangeId IN (${idList})`);
      return affectedIds.length;

    case 'orph_tm':
      execute(db, `DELETE FROM TagMap WHERE TagMapId IN (${idList})`);
      return affectedIds.length;

    case 'unused_tags':
      execute(db, `DELETE FROM Tag WHERE TagId IN (${idList})`);
      return affectedIds.length;

    case 'unused_loc':
      execute(db, `DELETE FROM Location WHERE LocationId IN (${idList})`);
      return affectedIds.length;

    default:
      return 0;
  }
}
