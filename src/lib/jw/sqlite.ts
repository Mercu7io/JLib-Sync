/**
 * JW Sync v3 — WebAssembly SQLite Management via sql.js
 * 100% Client-side. No network calls or server uploads for user data.
 * Bulletproof WASM loader with magic number verification (\0asm) and CDN fallback.
 */

import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import type { IManifest, ILibrarySummary } from './types.ts';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Loads and verifies the WebAssembly binary buffer before compiling.
 * Checks the standard \0asm (0x00, 0x61, 0x73, 0x6d) magic bytes to prevent
 * "CompileError: wasm validation error at offset 4" if a dev server returns index.html.
 */
async function loadWasmBinary(): Promise<ArrayBuffer> {
  // If running in Node.js / testing environment, load from local file directly
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    try {
      const nodeFs = 'fs';
      const nodePath = 'path';
      const fs = await import(/* @vite-ignore */ nodeFs);
      const path = await import(/* @vite-ignore */ nodePath);
      const localPaths = [
        path.resolve(process.cwd(), 'public/sql-wasm.wasm'),
        path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      ];
      for (const lp of localPaths) {
        if (fs.existsSync(lp)) {
          const buf = fs.readFileSync(lp);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        }
      }
    } catch (_) {}
  }

  const sources = [
    '/sql-wasm.wasm',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm',
    'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.wasm',
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const u8 = new Uint8Array(buf);
      // Validate WASM magic number: \0asm
      if (
        u8.length >= 8 &&
        u8[0] === 0x00 &&
        u8[1] === 0x61 &&
        u8[2] === 0x73 &&
        u8[3] === 0x6d
      ) {
        return buf;
      }
    } catch (_) {
      // try next source
    }
  }

  throw new Error(
    'Unable to load valid SQLite WebAssembly binary (magic number validation failed across all sources).'
  );
}

/**
 * Initializes sql.js using the pre-validated WASM buffer.
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const wasmBinary = await loadWasmBinary();
      return await initSqlJs({ wasmBinary });
    })();
  }
  return sqlJsPromise;
}

/**
 * Creates a new Database instance from a Uint8Array (or empty if omitted).
 */
export async function openDatabase(bytes?: Uint8Array): Promise<Database> {
  const SQL = await getSqlJs();
  return bytes ? new SQL.Database(bytes) : new SQL.Database();
}

/**
 * Checks if a table exists in the database.
 */
export function tableExists(db: Database, tableName: string): boolean {
  try {
    const stmt = db.prepare(
      "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name=:name"
    );
    stmt.bind({ ':name': tableName });
    let exists = false;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { c: number };
      exists = row.c > 0;
    }
    stmt.free();
    return exists;
  } catch (_) {
    return false;
  }
}

/**
 * Checks if a column exists in a given table.
 */
export function columnExists(db: Database, tableName: string, colName: string): boolean {
  try {
    const res = db.exec(`PRAGMA table_info("${tableName}")`);
    if (!res || !res[0]) return false;
    const nameIdx = res[0].columns.indexOf('name');
    return res[0].values.some((row) => row[nameIdx] === colName);
  } catch (_) {
    return false;
  }
}

/**
 * Sanitizes parameters passed to sql.js by converting undefined to null.
 * Prevents sql.js "Wrong API use : tried to bind a value of an unknown type (undefined)" errors.
 */
function sanitizeParams(params?: any[] | Record<string, any>): any[] | Record<string, any> | undefined {
  if (!params) return params;
  if (Array.isArray(params)) {
    return params.map((v) => (v === undefined ? null : v));
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    clean[k] = v === undefined ? null : v;
  }
  return clean;
}

/**
 * Executes a query and returns all rows as an array of objects.
 */
export function queryAll<T = Record<string, any>>(
  db: Database,
  sql: string,
  params?: any[] | Record<string, any>
): T[] {
  const results: T[] = [];
  try {
    const stmt = db.prepare(sql);
    if (params) {
      stmt.bind(sanitizeParams(params) as any);
    }
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
  } catch (err: any) {
    console.warn(`Query error: ${err?.message || err} \nSQL: ${sql}`);
  }
  return results;
}

/**
 * Executes a query and returns the first row as an object, or null.
 */
export function queryOne<T = Record<string, any>>(
  db: Database,
  sql: string,
  params?: any[] | Record<string, any>
): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Executes a statement with parameters.
 */
export function execute(
  db: Database,
  sql: string,
  params?: any[] | Record<string, any>
): void {
  if (params) {
    const stmt = db.prepare(sql);
    stmt.bind(sanitizeParams(params) as any);
    stmt.step();
    stmt.free();
  } else {
    db.run(sql);
  }
}

/**
 * Exports database into a Uint8Array byte buffer.
 */
export function exportDatabase(db: Database): Uint8Array {
  return db.export();
}

/**
 * Computes a quick summary of records in the database.
 */
export function getLibrarySummary(
  db: Database,
  manifest: IManifest,
  fileSizeBytes: number = 0
): ILibrarySummary {
  const count = (tbl: string): number => {
    if (!tableExists(db, tbl)) return 0;
    const row = queryOne<{ c: number }>(db, `SELECT COUNT(*) AS c FROM "${tbl}"`);
    return row ? row.c : 0;
  };

  let tagsCount = 0;
  let playlistsCount = 0;

  if (tableExists(db, 'Tag')) {
    if (columnExists(db, 'Tag', 'Type')) {
      const tagRow = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM Tag WHERE Type = 1');
      tagsCount = tagRow ? tagRow.c : 0;
      const plRow = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM Tag WHERE Type = 2');
      playlistsCount = plRow ? plRow.c : 0;
    } else {
      tagsCount = count('Tag');
    }
  }

  // Fallback to PlaylistItem if no Tag Type=2 or no Tag table
  if (playlistsCount === 0 && tableExists(db, 'PlaylistItem')) {
    playlistsCount = count('PlaylistItem');
  }

  return {
    name: manifest.name || 'Unknown Backup',
    deviceName: manifest.deviceName || manifest.userDataBackup?.deviceName || 'Unknown Device',
    lastModifiedDate: manifest.userDataBackup?.lastModifiedDate || manifest.creationDate || '',
    creationDate: manifest.creationDate || '',
    notesCount: count('Note'),
    userMarksCount: count('UserMark'),
    tagsCount,
    bookmarksCount: count('Bookmark'),
    inputFieldsCount: count('InputField'),
    playlistsCount,
    fileSizeBytes,
  };
}
