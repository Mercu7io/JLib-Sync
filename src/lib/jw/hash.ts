/**
 * Panda JWL-Sync — SHA-256 Computation Utility
 * Uses native Web Crypto API for ultra-fast, client-side checksums.
 */

export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
