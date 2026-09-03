/**
 * JW Sync v3 — Manifest Generator & SHA-256 Verification
 * Crucial: If manifest.json is missing or hash doesn't match userData.db,
 * JW Library will silently refuse to restore without any error prompt.
 */

import { IManifest } from './types';

// SHA-256 Round Constants for pure JS fallback
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/**
 * Pure JavaScript SHA-256 implementation as a fallback.
 */
function sha256PureJs(bytes: Uint8Array): string {
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const len = bytes.length;
  const withPad = new Uint8Array((((len + 8) >> 6) + 1) * 64);
  withPad.set(bytes);
  withPad[len] = 0x80;

  const bitsHi = Math.floor(len / 536870912);
  const bitsLo = (len << 3) >>> 0;
  const end = withPad.length;
  withPad[end - 8] = (bitsHi >>> 24) & 0xff;
  withPad[end - 7] = (bitsHi >>> 16) & 0xff;
  withPad[end - 6] = (bitsHi >>> 8) & 0xff;
  withPad[end - 5] = bitsHi & 0xff;
  withPad[end - 4] = (bitsLo >>> 24) & 0xff;
  withPad[end - 3] = (bitsLo >>> 16) & 0xff;
  withPad[end - 2] = (bitsLo >>> 8) & 0xff;
  withPad[end - 1] = bitsLo & 0xff;

  const w = new Int32Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] =
        (withPad[i + j * 4] << 24) |
        (withPad[i + j * 4 + 1] << 16) |
        (withPad[i + j * 4 + 2] << 8) |
        withPad[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const g0 = w[j - 15];
      const g1 = w[j - 2];
      const s0 = ((g0 >>> 7) | (g0 << 25)) ^ ((g0 >>> 18) | (g0 << 14)) ^ (g0 >>> 3);
      const s1 = ((g1 >>> 17) | (g1 << 15)) ^ ((g1 >>> 19) | (g1 << 13)) ^ (g1 >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let j = 0; j < 64; j++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[j] + w[j]) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + hh) | 0;
  }
  let out = '';
  for (let k = 0; k < 8; k++) {
    out += (h[k] >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

/**
 * Calculates SHA-256 hexadecimal string of a byte array.
 * Fast Web Crypto API path with pure JS fallback.
 */
export async function calculateSha256(bytes: Uint8Array): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (_) {
    // subtle failed or insecure context
  }
  return sha256PureJs(bytes);
}

/**
 * Creates or updates a manifest for userData.db.
 */
export async function createOrUpdateManifest(
  dbBytes: Uint8Array,
  existingManifest?: Partial<IManifest> | null,
  options?: { name?: string; deviceName?: string }
): Promise<IManifest> {
  const hash = await calculateSha256(dbBytes);
  const nowIso = new Date().toISOString();
  // JW Library standard lastModifiedDate: 2026-09-01T10:35:23Z
  const zuluTime = nowIso.replace(/\.\d{3}Z$/, 'Z');

  const baseName = options?.name || existingManifest?.name || 'JW Sync Backup';
  const deviceName = options?.deviceName || existingManifest?.deviceName || 'JW Sync (Web)';

  return {
    name: baseName,
    creationDate: existingManifest?.creationDate || nowIso,
    userDataBackupVersion: existingManifest?.userDataBackupVersion || 14,
    deviceName,
    type: existingManifest?.type ?? 0,
    version: existingManifest?.version ?? 1,
    userDataBackup: {
      hash,
      lastModifiedDate: zuluTime,
      databaseName: 'userData.db',
      deviceName: 'JW Sync',
      schemaVersion: existingManifest?.userDataBackup?.schemaVersion ?? 16,
    },
  };
}
