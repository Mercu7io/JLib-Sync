import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTextSize } from '../src/lib/theme.ts';
import { computeSha256 } from '../src/lib/jw/hash.ts';

test('normalizeTextSize: handles standard numeric and label levels', () => {
  assert.equal(normalizeTextSize(1), 1);
  assert.equal(normalizeTextSize(2), 2);
  assert.equal(normalizeTextSize(3), 3);
  assert.equal(normalizeTextSize(4), 4);
  assert.equal(normalizeTextSize(5), 5);
  assert.equal(normalizeTextSize('small'), 1);
  assert.equal(normalizeTextSize('normal'), 2);
  assert.equal(normalizeTextSize('large'), 3);
  assert.equal(normalizeTextSize('xlarge'), 4);
  assert.equal(normalizeTextSize('xxlarge'), 5);
});

test('normalizeTextSize: edge cases fall back to default Level 3', () => {
  assert.equal(normalizeTextSize(0 as any), 3);
  assert.equal(normalizeTextSize(99 as any), 3);
  assert.equal(normalizeTextSize('unknown' as any), 3);
  assert.equal(normalizeTextSize(null as any), 3);
  assert.equal(normalizeTextSize(undefined as any), 3);
});

test('computeSha256: correctly computes SHA-256 for standard data and empty data', async () => {
  // Empty buffer SHA-256 is standard e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  const empty = new Uint8Array(0);
  const emptySha = await computeSha256(empty);
  assert.equal(emptySha, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

  // "hello" utf-8 bytes
  const helloBytes = new TextEncoder().encode('hello');
  const helloSha = await computeSha256(helloBytes);
  assert.equal(helloSha, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

test('GoogleDriveManager: token expiration and persistence handling', async () => {
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
  }
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  // 1. Initial state: disconnected and not previously connected
  localStorage.clear();
  assert.equal(driveManager.isConnected(), false);
  assert.equal(driveManager.wasPreviouslyConnected(), false);
  assert.equal(driveManager.isSessionExpired(), false);
  assert.equal(driveManager.getStoredToken(), null);

  // 2. Simulate valid active token
  const validExpiresAt = Date.now() + 3600 * 1000;
  localStorage.setItem('jwsync_drive_token', 'valid_token_xyz');
  localStorage.setItem('jwsync_drive_token_expires_at', validExpiresAt.toString());
  localStorage.setItem('jwsync_drive_connected', 'true');

  assert.equal(driveManager.wasPreviouslyConnected(), true);
  assert.equal(driveManager.getStoredToken(), 'valid_token_xyz');
  assert.equal(driveManager.isSessionExpired(), false);

  // 3. Simulate expired token
  const pastExpiresAt = Date.now() - 1000;
  localStorage.setItem('jwsync_drive_token_expires_at', pastExpiresAt.toString());

  assert.equal(driveManager.getStoredToken(), null);
  assert.equal(driveManager.wasPreviouslyConnected(), true);
  assert.equal(driveManager.isSessionExpired(), true);

  // 4. handleSessionExpired preserves 'jwsync_drive_connected'
  let expiredCallbackCalled = false;
  // Initialize with expired callback
  await driveManager.init(undefined, () => {
    expiredCallbackCalled = true;
  });
  driveManager.handleSessionExpired();

  assert.equal(localStorage.getItem('jwsync_drive_token'), null);
  assert.equal(localStorage.getItem('jwsync_drive_token_expires_at'), null);
  assert.equal(localStorage.getItem('jwsync_drive_connected'), 'true');
  assert.equal(driveManager.isSessionExpired(), true);
  assert.equal(expiredCallbackCalled, true);

  // 5. Explicit logout clears everything including connection flag
  driveManager.logout();
  assert.equal(localStorage.getItem('jwsync_drive_connected'), null);
  assert.equal(driveManager.wasPreviouslyConnected(), false);
  assert.equal(driveManager.isSessionExpired(), false);
});

test('extractJwLibrary: tracks progress stages with percentages', async () => {
  const JSZip = (await import('jszip')).default;
  const { extractJwLibrary } = await import('../src/lib/jw/zip.ts');

  const zip = new JSZip();
  const manifest = {
    name: 'Test Backup',
    creationDate: '2026-09-04',
    version: 1,
    type: 0,
    userDataBackup: {
      lastModifiedDate: '2026-09-04T20:00:00Z',
      deviceName: 'TestDevice',
      databaseName: 'userData.db',
      schemaVersion: 14,
    },
  };

  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('userData.db', new Uint8Array([1, 2, 3, 4]));

  const zipBytes = await zip.generateAsync({ type: 'uint8array' });

  const progressUpdates: Array<{ stage: string; percent: number }> = [];
  const extracted = await extractJwLibrary(zipBytes, 'test.jwlibrary', (p) => {
    progressUpdates.push({ ...p });
  });

  assert.equal(extracted.manifest.name, 'Test Backup');
  assert.equal(extracted.dbBytes.length, 4);
  assert.ok(progressUpdates.length >= 3, 'Should have emitted multiple progress updates');
  assert.ok(progressUpdates[0].percent >= 10, 'Initial percent should be >= 10');
  assert.ok(progressUpdates[progressUpdates.length - 1].percent >= 90, 'Final percent should be >= 90');
});

test('packageJwLibrary: reports progressive compression percentages up to 100%', async () => {
  const { packageJwLibrary } = await import('../src/lib/jw/zip.ts');
  const manifest = {
    name: 'Package Test',
    creationDate: '2026-09-04',
    version: 1,
    type: 0,
    userDataBackup: {
      lastModifiedDate: '2026-09-04T20:00:00Z',
      deviceName: 'TestDevice',
      databaseName: 'userData.db',
      schemaVersion: 14,
    },
  };

  const dbBytes = new Uint8Array(1024 * 50); // 50KB data to trigger compression chunks
  const progressReports: number[] = [];

  const blob = await packageJwLibrary(
    dbBytes,
    manifest,
    undefined,
    (percent) => {
      progressReports.push(percent);
    }
  );

  assert.ok(blob instanceof Blob, 'Should return a Blob instance');
  assert.ok(blob.size > 0, 'Generated blob should not be empty');
  assert.ok(progressReports.length > 0, 'Progress callback should be invoked during packaging');
  assert.equal(progressReports[progressReports.length - 1], 100, 'Last progress report should reach 100%');
});

test('GoogleDriveManager: uploadBackup reports progress callback', async () => {
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  // Setup mock folder and token
  (driveManager as any).accessToken = 'mock_token';
  (driveManager as any).folderId = 'mock_folder_id';

  // Mock request method for initial metadata creation
  const originalRequest = (driveManager as any).request;
  (driveManager as any).request = async (endpoint: string) => {
    if (endpoint === '/files') {
      return { id: 'mock_uploaded_file_id', name: 'test.jwlibrary' };
    }
    return {};
  };

  // Mock global fetch for the PATCH upload
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({ id: 'mock_uploaded_file_id', name: 'test.jwlibrary' }),
    } as any;
  };

  const progressUpdates: number[] = [];
  const fakeBlob = new Blob(['test content'], { type: 'application/octet-stream' });

  try {
    const res = await driveManager.uploadBackup('test.jwlibrary', fakeBlob, undefined, (percent) => {
      progressUpdates.push(percent);
    });

    assert.equal(res.id, 'mock_uploaded_file_id');
    assert.ok(progressUpdates.includes(100), 'Progress callback must report 100% upon completion');
  } finally {
    (driveManager as any).request = originalRequest;
    globalThis.fetch = originalFetch;
  }
});

test('extractJwLibrary: resilience handles raw unzipped SQLite database files without crashing', async () => {
  const { extractJwLibrary } = await import('../src/lib/jw/zip.ts');

  // Construct fake raw SQLite database bytes starting with "SQLite format 3\0"
  const headerText = 'SQLite format 3\0';
  const fakeDbBytes = new Uint8Array(1024);
  for (let i = 0; i < headerText.length; i++) {
    fakeDbBytes[i] = headerText.charCodeAt(i);
  }

  const rawBlob = new Blob([fakeDbBytes], { type: 'application/x-sqlite3' });
  const result = await extractJwLibrary(rawBlob, 'UserdataBackup_2026-09-01.jwlibrary');

  assert.ok(result.manifest, 'Manifest should be automatically synthesized');
  assert.equal(result.manifest.userDataBackup?.databaseName, 'userData.db');
  assert.equal(result.dbBytes.byteLength, 1024);
});

test('packageJwLibrary: preserves extraFiles and produces a valid ZIP archive unpackable by extractJwLibrary', async () => {
  const { packageJwLibrary, extractJwLibrary } = await import('../src/lib/jw/zip.ts');

  const manifest = {
    name: 'BackupWithMedia',
    creationDate: '2026-09-04T20:00:00Z',
    userDataBackupVersion: 1,
    deviceName: 'TestDevice',
    version: 1,
    type: 0,
    userDataBackup: {
      lastModifiedDate: '2026-09-04T20:00:00Z',
      deviceName: 'TestDevice',
      databaseName: 'userData.db',
      schemaVersion: 14,
    },
  };

  const dbBytes = new Uint8Array(2048);
  const extraFiles = new Map<string, Uint8Array>();
  extraFiles.set('default_thumbnail.png', new Uint8Array([137, 80, 78, 71]));
  extraFiles.set('media/sample.jpg', new Uint8Array([255, 216, 255]));

  const packagedBlob = await packageJwLibrary(dbBytes, manifest as any, extraFiles);
  assert.ok(packagedBlob.size > 0);

  // Now unpack it back and verify extra files are preserved
  const unpacked = await extractJwLibrary(packagedBlob, 'test.jwlibrary');
  assert.equal(unpacked.extraFiles.size, 2);
  assert.ok(unpacked.extraFiles.has('default_thumbnail.png'));
  assert.ok(unpacked.extraFiles.has('media/sample.jpg'));
});

test('CloudCrypto: encrypts and decrypts a packaged .jwlibrary blob with clean extraction', async () => {
  const { packageJwLibrary, extractJwLibrary } = await import('../src/lib/jw/zip.ts');
  const { CloudCrypto } = await import('../src/lib/cloud/crypto.ts');

  const manifest = {
    name: 'EncryptedBackup',
    creationDate: '2026-09-04T20:00:00Z',
    userDataBackupVersion: 1,
    deviceName: 'TestDevice',
    version: 1,
    type: 0,
    userDataBackup: {
      lastModifiedDate: '2026-09-04T20:00:00Z',
      deviceName: 'TestDevice',
      databaseName: 'userData.db',
      schemaVersion: 14,
    },
  };

  const dbBytes = new Uint8Array(4096);
  const extraFiles = new Map<string, Uint8Array>();
  extraFiles.set('media/note_photo.jpg', new Uint8Array([1, 2, 3, 4, 5]));

  const zipBlob = await packageJwLibrary(dbBytes, manifest as any, extraFiles);
  const password = 'SuperSecretPassword123!';

  // Encrypt
  const crypto = new CloudCrypto();
  const zipArrayBuffer = await zipBlob.arrayBuffer();
  const encryptedBytes = await crypto.encrypt(zipArrayBuffer, password);
  assert.ok(encryptedBytes.length > 28);

  // Decrypt
  const decryptedBytes = await crypto.decrypt(encryptedBytes, password);
  const decryptedBlob = new Blob([decryptedBytes], { type: 'application/zip' });

  // Unpack decrypted blob
  const extracted = await extractJwLibrary(decryptedBlob, 'EncryptedBackup.jwlibrary');
  assert.equal(extracted.manifest.name, 'EncryptedBackup');
  assert.equal(extracted.extraFiles.size, 1);
  assert.ok(extracted.extraFiles.has('media/note_photo.jpg'));
});

test('validateBackupName: validates and sanitizes backup filenames with extension preservation', async () => {
  const { validateBackupName, getEditableBaseName } = await import('../src/lib/cloud/renameSchema.ts');

  // getEditableBaseName
  assert.equal(getEditableBaseName('MyStudy.jwlibrary'), 'MyStudy');
  assert.equal(getEditableBaseName('MyStudy.jwlibrary.enc'), 'MyStudy');
  assert.equal(getEditableBaseName('SimpleName'), 'SimpleName');

  // Main case: standard backup rename without typing extension
  const res1 = validateBackupName({
    newName: 'NewStudy2026',
    originalName: 'OldStudy.jwlibrary',
  });
  assert.equal(res1.isValid, true);
  assert.equal(res1.sanitizedName, 'NewStudy2026.jwlibrary');

  // Main case: standard backup rename with typed extension
  const res2 = validateBackupName({
    newName: 'NewStudy2026.jwlibrary',
    originalName: 'OldStudy.jwlibrary',
  });
  assert.equal(res2.isValid, true);
  assert.equal(res2.sanitizedName, 'NewStudy2026.jwlibrary');

  // Encrypted case: preserves .enc when user enters plain name
  const res3 = validateBackupName({
    newName: 'SecretNotes',
    originalName: 'OldSecret.jwlibrary.enc',
  });
  assert.equal(res3.isValid, true);
  assert.equal(res3.sanitizedName, 'SecretNotes.jwlibrary.enc');

  // Encrypted case: handles if user enters .jwlibrary or .jwlibrary.enc
  const res4 = validateBackupName({
    newName: 'SecretNotes.jwlibrary.enc',
    originalName: 'OldSecret.jwlibrary.enc',
  });
  assert.equal(res4.isValid, true);
  assert.equal(res4.sanitizedName, 'SecretNotes.jwlibrary.enc');

  // Edge case: empty or whitespace
  const resEmpty = validateBackupName({
    newName: '   ',
    originalName: 'Old.jwlibrary',
  });
  assert.equal(resEmpty.isValid, false);
  assert.equal(resEmpty.errorCode, 'EMPTY');

  // Edge case: invalid characters
  const resInvalid = validateBackupName({
    newName: 'Invalid/Name:Test',
    originalName: 'Old.jwlibrary',
  });
  assert.equal(resInvalid.isValid, false);
  assert.equal(resInvalid.errorCode, 'INVALID_CHARS');

  // Edge case: identical name
  const resSame = validateBackupName({
    newName: 'SameName',
    originalName: 'SameName.jwlibrary',
  });
  assert.equal(resSame.isValid, false);
  assert.equal(resSame.errorCode, 'SAME_NAME');

  // Edge case: too long (> 255 characters)
  const resLong = validateBackupName({
    newName: 'a'.repeat(250),
    originalName: 'Old.jwlibrary',
  });
  assert.equal(resLong.isValid, false);
  assert.equal(resLong.errorCode, 'TOO_LONG');
});

test('GoogleDriveManager: renameBackup sends PATCH request and updates index', async () => {
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  (driveManager as any).accessToken = 'mock_token';
  (driveManager as any).folderId = 'mock_folder_id';

  let patchCalled = false;
  let patchEndpoint = '';
  let patchBody: any = null;

  const originalRequest = (driveManager as any).request;
  const originalFetchIndex = driveManager.fetchIndex.bind(driveManager);
  const originalSaveIndex = driveManager.saveIndex.bind(driveManager);

  // Mock request
  (driveManager as any).request = async (endpoint: string, options: any) => {
    if (options?.method === 'PATCH') {
      patchCalled = true;
      patchEndpoint = endpoint;
      patchBody = JSON.parse(options.body);
      return { id: 'file_123', name: patchBody.name };
    }
    return originalRequest.call(driveManager, endpoint, options);
  };

  let savedIndex: any = null;
  // Mock fetchIndex and saveIndex
  driveManager.fetchIndex = async () => {
    return {
      version: 1,
      lastUpdated: '2026-09-04T00:00:00Z',
      backups: [
        {
          fileId: 'file_123',
          fileName: 'OldName.jwlibrary',
          sha256: 'abc123',
          uploadedAt: '2026-09-04T00:00:00Z',
        },
        {
          fileId: 'file_456',
          fileName: 'OtherFile.jwlibrary',
          sha256: 'def456',
          uploadedAt: '2026-09-04T00:00:00Z',
        },
      ],
    };
  };

  driveManager.saveIndex = async (index: any) => {
    savedIndex = index;
  };

  try {
    const result = await driveManager.renameBackup('file_123', 'NewName.jwlibrary');

    assert.equal(patchCalled, true);
    assert.equal(patchEndpoint, '/files/file_123');
    assert.equal(patchBody.name, 'NewName.jwlibrary');
    assert.equal(result.name, 'NewName.jwlibrary');

    // Verify index was updated properly
    assert.ok(savedIndex !== null);
    const updatedEntry = savedIndex.backups.find((b: any) => b.fileId === 'file_123');
    const unchangedEntry = savedIndex.backups.find((b: any) => b.fileId === 'file_456');
    assert.equal(updatedEntry.fileName, 'NewName.jwlibrary');
    assert.equal(unchangedEntry.fileName, 'OtherFile.jwlibrary');
  } finally {
    (driveManager as any).request = originalRequest;
    driveManager.fetchIndex = originalFetchIndex;
    driveManager.saveIndex = originalSaveIndex;
  }
});



