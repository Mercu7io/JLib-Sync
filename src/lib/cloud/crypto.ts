/**
 * JW Sync v3 — Client-Side Zero-Knowledge Encryption (AES-GCM 256 + PBKDF2)
 * Allows optional encryption of backups before uploading to Google Drive.
 */

export class CloudCrypto {
  private iterations = 100000; // PBKDF2 standard
  private keyLength = 256;     // AES-256
  private digest = 'SHA-256';

  private getCrypto(): Crypto {
    if (typeof window !== 'undefined' && window.crypto) return window.crypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto as Crypto;
    throw new Error('Web Crypto API is not available in this environment.');
  }

  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const crypto = this.getCrypto();
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
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
    const crypto = this.getCrypto();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const encryptedContent = await crypto.subtle.encrypt(
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
    const crypto = this.getCrypto();
    const packedData = new Uint8Array(packedBuffer);
    if (packedData.length < 28) {
      throw new Error('Encrypted payload is too short to be valid.');
    }

    const salt = packedData.slice(0, 16);
    const iv = packedData.slice(16, 28);
    const ciphertext = packedData.slice(28);

    const key = await this.deriveKey(password, salt);

    try {
      const decryptedContent = await crypto.subtle.decrypt(
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
