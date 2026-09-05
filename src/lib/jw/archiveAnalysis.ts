/**
 * Panda JWL-Sync — Direct .jwlibrary Archive Analyzer
 * Extracts and inspects a .jwlibrary bundle to compute counts (notes, tags, playlists, bookmarks)
 * and SHA-256 hash without mutating the active app workspace.
 */

import { extractJwLibrary } from './zip.ts';
import { openDatabase, getLibrarySummary } from './sqlite.ts';
import { computeSha256 } from './hash.ts';
import type { IManifest } from './types.ts';

export interface IJwLibraryAnalysis {
  manifest: IManifest;
  sha256: string;
  notesCount: number;
  tagsCount: number;
  playlistsCount: number;
  bookmarksCount: number;
  dbBytes: Uint8Array;
}

/**
 * Extracts and summarizes a .jwlibrary file in-memory.
 * Returns null if the file is encrypted (.enc) or cannot be parsed as a SQLite JWL bundle.
 */
export async function analyzeJwLibraryFile(
  fileOrBlob: Blob | File,
  fileName?: string
): Promise<IJwLibraryAnalysis | null> {
  const name = fileName || (fileOrBlob instanceof File ? fileOrBlob.name : 'backup.jwlibrary');
  if (name.endsWith('.enc')) {
    return null;
  }

  const { dbBytes, manifest } = await extractJwLibrary(fileOrBlob, name);
  const db = await openDatabase(dbBytes);
  try {
    const summary = getLibrarySummary(db, manifest, fileOrBlob.size);
    const sha256 = await computeSha256(dbBytes);
    return {
      manifest,
      sha256,
      notesCount: summary.notesCount,
      tagsCount: summary.tagsCount,
      playlistsCount: summary.playlistsCount,
      bookmarksCount: summary.bookmarksCount,
      dbBytes,
    };
  } finally {
    try {
      db.close();
    } catch (_) {}
  }
}
