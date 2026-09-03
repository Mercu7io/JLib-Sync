/**
 * JW Sync v3 — Zip Archiver & Extractor for .jwlibrary bundles
 * A .jwlibrary file is a standard ZIP archive containing:
 * - manifest.json
 * - userData.db
 * - optional extra files (e.g. default_thumbnail.png, IndependentMedia images/slides)
 */

import JSZip from 'jszip';
import { IManifest } from './types';
import { calculateSha256 } from './manifest';

export interface IExtractedJwLibrary {
  manifest: IManifest;
  dbBytes: Uint8Array;
  fileName: string;
  fileSizeBytes: number;
  extraFiles: Map<string, Uint8Array>;
}

/**
 * Extracts userData.db, manifest.json, and all attached media files from a .jwlibrary file or blob.
 */
export async function extractJwLibrary(
  fileOrBlob: Blob | File | ArrayBuffer,
  defaultName: string = 'backup.jwlibrary'
): Promise<IExtractedJwLibrary> {
  const fileName = fileOrBlob instanceof File ? fileOrBlob.name : defaultName;
  const fileSizeBytes =
    fileOrBlob instanceof ArrayBuffer
      ? fileOrBlob.byteLength
      : fileOrBlob.size;

  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileOrBlob);

  // Read manifest.json
  const manifestFile = loadedZip.file('manifest.json');
  if (!manifestFile) {
    throw new Error(
      'Invalid .jwlibrary archive: "manifest.json" not found in the backup root.'
    );
  }
  const manifestText = await manifestFile.async('text');
  let manifest: IManifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    throw new Error('Failed to parse manifest.json: ' + (err as Error).message);
  }

  // Find database (normally userData.db, or specified by manifest)
  const dbName = manifest.userDataBackup?.databaseName || 'userData.db';
  const dbFile = loadedZip.file(dbName) || loadedZip.file('userData.db');
  if (!dbFile) {
    throw new Error(
      `Invalid .jwlibrary archive: database file "${dbName}" not found.`
    );
  }

  const dbBytes = await dbFile.async('uint8array');

  // Preserve any extra files (thumbnails, user images, slides)
  const extraFiles = new Map<string, Uint8Array>();
  for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
    if (
      !zipEntry.dir &&
      relativePath !== 'manifest.json' &&
      relativePath !== dbName &&
      relativePath !== 'userData.db'
    ) {
      const bytes = await zipEntry.async('uint8array');
      extraFiles.set(relativePath, bytes);
    }
  }

  return {
    manifest,
    dbBytes,
    fileName,
    fileSizeBytes,
    extraFiles,
  };
}

/**
 * Packages userData.db, manifest.json, and any extra media files into a downloadable .jwlibrary Blob.
 * Automatically verifies and stamps the SHA-256 hash in manifest.json.
 */
export async function packageJwLibrary(
  dbBytes: Uint8Array,
  manifest: IManifest,
  extraFiles?: Map<string, Uint8Array>
): Promise<Blob> {
  // Ensure hash matches the exact dbBytes being zipped
  const hash = await calculateSha256(dbBytes);
  const updatedManifest: IManifest = {
    ...manifest,
    userDataBackup: {
      ...manifest.userDataBackup,
      hash,
      databaseName: 'userData.db',
    },
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(updatedManifest, null, 2));
  zip.file('userData.db', dbBytes);

  // Re-attach extra media files if present
  if (extraFiles) {
    for (const [filePath, fileData] of extraFiles.entries()) {
      zip.file(filePath, fileData);
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
