/**
 * JW Sync v3 — Client-Side Zero-Knowledge Encryption (AES-GCM 256 + PBKDF2)
 * Allows optional encryption of backups before uploading to Google Drive.
 */

export class CloudCrypto {
  private iterations = 100000; // PBKDF2 standard
  private keyLength = 256;     // AES-256
  private digest = 'SHA-256';

  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: this.iterations,
        hash: this.digest,
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(buffer: ArrayBuffer | Uint8Array, password: string): Promise<Uint8Array> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      buffer as unknown as BufferSource
    );

    const encryptedArray = new Uint8Array(encryptedContent);
    const packedData = new Uint8Array(salt.byteLength + iv.byteLength + encryptedArray.byteLength);

    packedData.set(salt, 0);
    packedData.set(iv, salt.byteLength);
    packedData.set(encryptedArray, salt.byteLength + iv.byteLength);

    return packedData;
  }

  async decrypt(packedBuffer: ArrayBuffer | Uint8Array, password: string): Promise<Uint8Array> {
    const packedData = new Uint8Array(packedBuffer);
    if (packedData.length < 28) {
      throw new Error('Encrypted payload is too short to be valid.');
    }

    const salt = packedData.slice(0, 16);
    const iv = packedData.slice(16, 28);
    const ciphertext = packedData.slice(28);

    const key = await this.deriveKey(password, salt);

    try {
      const decryptedContent = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource
      );
      return new Uint8Array(decryptedContent);
    } catch (_) {
      throw new Error('Decryption failed. The password may be incorrect or the file is corrupted.');
    }
  }
}
