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

test('APP_VERSION: adheres to semver and defines build date', async () => {
  const { APP_VERSION, APP_BUILD_DATE } = await import('../src/lib/version.ts');
  assert.ok(typeof APP_VERSION === 'string');
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+/);
  assert.ok(typeof APP_BUILD_DATE === 'string');
  assert.ok(APP_BUILD_DATE.length > 0);
});

test('forceAppUpdate: executes safely in non-browser or mock environments', async () => {
  const { forceAppUpdate } = await import('../src/lib/pwaUpdate.ts');
  // In node environment without window, should return cleanly without error
  await assert.doesNotReject(async () => {
    await forceAppUpdate();
  });
});

test('i18n: en and fr contain all required cloud and help keys', async () => {
  const { en } = await import('../src/locales/en.ts');
  const { fr } = await import('../src/locales/fr.ts');

  // Cloud keys
  assert.equal(en.cloud.encryptedBadge, 'Encrypted');
  assert.equal(fr.cloud.encryptedBadge, 'Chiffré');
  assert.equal(en.cloud.encryptedTooltip, 'AES-256 Encrypted');
  assert.equal(fr.cloud.encryptedTooltip, 'Chiffré AES-256');
  assert.equal(en.cloud.unverifiedBadge, 'Unverified');
  assert.equal(fr.cloud.unverifiedBadge, 'Non vérifié');
  assert.ok(en.cloud.uploadingWithProgress.includes('{{percent}}'));
  assert.ok(fr.cloud.uploadingWithProgress.includes('{{percent}}'));

  // Help keys
  assert.ok(en.help.faqLockQ.length > 5);
  assert.ok(fr.help.faqLockQ.length > 5);
  assert.ok(en.help.faqPwaQ.length > 5);
  assert.ok(fr.help.faqPwaA.length > 10);
  assert.ok(en.help.gdprTitle.length > 5);
  assert.ok(fr.help.gdprTitle.length > 5);
  assert.ok(en.help.gdprDesc.length > 20);
  assert.ok(fr.help.gdprDesc.length > 20);
  assert.ok(en.help.viewFullPolicy.length > 5);
  assert.ok(fr.help.viewFullPolicy.length > 5);
});

test('GoogleDriveManager: uploadBackup emits accurate progressive percentages up to 100%', async () => {
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  // Setup mock folder and token
  (driveManager as any).accessToken = 'mock_token';
  (driveManager as any).folderId = 'mock_folder_id';

  const originalRequest = (driveManager as any).request;
  (driveManager as any).request = async (endpoint: string) => {
    if (endpoint === '/files') {
      return { id: 'mock_uploaded_file_id', name: 'test.jwlibrary' };
    }
    return {};
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({ id: 'mock_uploaded_file_id', name: 'test.jwlibrary' }),
    } as any;
  };

  const progressUpdates: number[] = [];
  const fakeBlob = new Blob(['test content for progress'], { type: 'application/octet-stream' });

  try {
    const res = await driveManager.uploadBackup('test_progress.jwlibrary', fakeBlob, undefined, (percent) => {
      progressUpdates.push(percent);
    });

    assert.equal(res.id, 'mock_uploaded_file_id');
    assert.ok(progressUpdates.length > 0);
    assert.equal(progressUpdates[progressUpdates.length - 1], 100);
  } finally {
    (driveManager as any).request = originalRequest;
    globalThis.fetch = originalFetch;
  }
});

test('getDefaultMergeFilename: formats default merge name as YYYY-MM-DD_Panda_JWL.jwlibrary', async () => {
  const { getDefaultMergeFilename } = await import('../src/lib/jw/merge.ts');

  // Specific date test (2026-09-01)
  const specificDate = new Date(2026, 8, 1); // Month is 0-indexed (8 = September)
  assert.equal(getDefaultMergeFilename(specificDate), '2026-09-01_Panda_JWL.jwlibrary');

  // Default (current) date test format
  const currentDefault = getDefaultMergeFilename();
  assert.match(currentDefault, /^\d{4}-\d{2}-\d{2}_Panda_JWL\.jwlibrary$/);
});

test('GoogleDriveManager: uploadBackup deletes draft stub on upload failure (rollback)', async () => {
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  (driveManager as any).accessToken = 'mock_token';
  (driveManager as any).folderId = 'mock_folder_id';

  const deletedIds: string[] = [];
  const originalRequest = (driveManager as any).request;
  (driveManager as any).request = async (endpoint: string, options: any = {}) => {
    if (endpoint === '/files' && options.method === 'POST') {
      return { id: 'stub_to_delete', name: 'failed_backup.jwlibrary' };
    }
    if (endpoint === '/files/stub_to_delete' && options.method === 'DELETE') {
      deletedIds.push('stub_to_delete');
      return {};
    }
    return {};
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    // Simulate failed network upload
    return {
      ok: false,
      statusText: 'Network connection dropped',
    } as any;
  };

  const fakeBlob = new Blob(['sample data'], { type: 'application/octet-stream' });

  try {
    await assert.rejects(
      async () => {
        await driveManager.uploadBackup('failed_backup.jwlibrary', fakeBlob);
      },
      /Upload to Google Drive failed/
    );

    // Verify stub was automatically deleted
    assert.deepEqual(deletedIds, ['stub_to_delete'], 'Draft file must be rolled back on upload failure');
  } finally {
    (driveManager as any).request = originalRequest;
    globalThis.fetch = originalFetch;
  }
});

test('GoogleDriveManager: listBackups filters 0-byte stubs, triggers cleanup, and marks isValidated', async () => {
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  (driveManager as any).accessToken = 'mock_token';
  (driveManager as any).folderId = 'mock_folder_id';

  const originalRequest = (driveManager as any).request;
  const deletedBatches: string[][] = [];

  (driveManager as any).request = async (endpoint: string) => {
    if (endpoint.startsWith('/files?')) {
      return {
        files: [
          { id: 'zero_byte_1', name: 'aborted.jwlibrary', size: '0' },
          { id: 'zero_byte_2', name: 'corrupted.jwlibrary', size: '0' },
          { id: 'valid_with_sha', name: 'valid.jwlibrary', size: '5000', appProperties: { sha256: 'abcdef1234567890' } },
          { id: 'valid_no_sha', name: 'unverified.jwlibrary', size: '3000', appProperties: {} },
        ],
      };
    }
    return {};
  };

  const originalBatchDelete = (driveManager as any).batchDeleteBackups;
  (driveManager as any).batchDeleteBackups = async (ids: string[]) => {
    deletedBatches.push(ids);
  };

  const originalFetchIndex = (driveManager as any).fetchIndex;
  (driveManager as any).fetchIndex = async () => null;

  try {
    const list = await driveManager.listBackups();

    // 0-byte files should be hidden
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'valid_with_sha');
    assert.equal(list[0].isValidated, true);
    assert.equal(list[1].id, 'valid_no_sha');
    assert.equal(list[1].isValidated, false);

    // 0-byte files should be queued for cleanup
    assert.deepEqual(deletedBatches, [['zero_byte_1', 'zero_byte_2']]);
  } finally {
    (driveManager as any).request = originalRequest;
    (driveManager as any).batchDeleteBackups = originalBatchDelete;
    (driveManager as any).fetchIndex = originalFetchIndex;
  }
});

test('GoogleDriveManager: stores and returns notes, tags, and playlists metrics', async () => {
  const { driveManager } = await import('../src/lib/cloud/googleDrive.ts');

  (driveManager as any).accessToken = 'mock_token';
  (driveManager as any).folderId = 'mock_folder_id';

  let capturedMetadata: any = null;
  const originalRequest = (driveManager as any).request;
  (driveManager as any).request = async (endpoint: string, options: any = {}) => {
    if (endpoint === '/files' && options.method === 'POST') {
      capturedMetadata = JSON.parse(options.body);
      return { id: 'file_with_metrics', name: 'metrics_test.jwlibrary' };
    }
    if (endpoint.startsWith('/files?')) {
      return {
        files: [
          {
            id: 'file_with_metrics',
            name: 'metrics_test.jwlibrary',
            size: '8192',
            appProperties: {
              sha256: 'fedcba9876543210',
              notesCount: '45',
              tagsCount: '7',
              playlistsCount: '3',
            },
          },
        ],
      };
    }
    return {};
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ id: 'file_with_metrics', name: 'metrics_test.jwlibrary' }),
  } as any);

  const fakeBlob = new Blob(['dummy content'], { type: 'application/octet-stream' });

  try {
    const uploaded = await driveManager.uploadBackup('metrics_test.jwlibrary', fakeBlob, {
      sha256: 'fedcba9876543210',
      notesCount: 45,
      tagsCount: 7,
      playlistsCount: 3,
    });

    assert.equal(uploaded.notesCount, 45);
    assert.equal(uploaded.tagsCount, 7);
    assert.equal(uploaded.playlistsCount, 3);
    assert.equal(capturedMetadata.appProperties.notesCount, '45');
    assert.equal(capturedMetadata.appProperties.tagsCount, '7');
    assert.equal(capturedMetadata.appProperties.playlistsCount, '3');

    const listed = await driveManager.listBackups();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].notesCount, 45);
    assert.equal(listed[0].tagsCount, 7);
    assert.equal(listed[0].playlistsCount, 3);
  } finally {
    (driveManager as any).request = originalRequest;
    globalThis.fetch = originalFetch;
  }
});

test('validateContactInput: validates typed schema for contact inputs', async () => {
  const { validateContactInput } = await import('../src/lib/contact/web3forms.ts');

  // Nominal valid case
  const validRes = validateContactInput({
    name: 'Brother Smith',
    email: 'brother.smith@example.org',
    subject: 'Merge feedback',
    message: 'Thank you for this wonderful tool, it helped me merge my notes seamlessly!',
    category: 'question',
  });
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.errorKey, undefined);

  // Edge case 1: name too short
  const shortNameRes = validateContactInput({
    name: 'A',
    email: 'valid@example.com',
    subject: 'Test',
    message: 'Valid message with more than 10 characters',
  });
  assert.equal(shortNameRes.isValid, false);
  assert.equal(shortNameRes.errorKey, 'help.contactErrName');

  // Edge case 2: invalid email
  const invalidEmailRes = validateContactInput({
    name: 'Valid Name',
    email: 'not-an-email',
    subject: 'Test',
    message: 'Valid message with more than 10 characters',
  });
  assert.equal(invalidEmailRes.isValid, false);
  assert.equal(invalidEmailRes.errorKey, 'help.contactErrEmail');

  // Edge case 3: message too short (< 10 chars)
  const shortMsgRes = validateContactInput({
    name: 'Valid Name',
    email: 'valid@example.com',
    subject: 'Test',
    message: 'Hi',
  });
  assert.equal(shortMsgRes.isValid, false);
  assert.equal(shortMsgRes.errorKey, 'help.contactErrMessage');

  // Edge case 4: subject empty
  const emptySubjectRes = validateContactInput({
    name: 'Valid Name',
    email: 'valid@example.com',
    subject: '',
    message: 'Valid message with more than 10 characters',
  });
  assert.equal(emptySubjectRes.isValid, false);
  assert.equal(emptySubjectRes.errorKey, 'help.contactErrSubject');
});

test('sendContactMessage: handles Web3Forms dispatch, honeypot, and error states', async () => {
  const { sendContactMessage } = await import('../src/lib/contact/web3forms.ts');

  let capturedUrl = '';
  let capturedBody: any = null;

  const mockFetch: any = async (url: string, opts: any) => {
    capturedUrl = url;
    capturedBody = opts.body;
    return {
      ok: true,
      json: async () => ({ success: true, message: 'Submission successful' }),
    };
  };

  // Nominal dispatch case
  const res = await sendContactMessage(
    {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Feature request',
      message: 'Can you add support for custom color themes?',
      category: 'feature',
      appVersion: '3.0.0',
    },
    'mock_key_123',
    mockFetch
  );

  assert.equal(res.success, true);
  assert.equal(capturedUrl, 'https://api.web3forms.com/submit');
  assert.ok(capturedBody instanceof FormData);
  assert.equal(capturedBody.get('access_key'), 'mock_key_123');
  assert.equal(capturedBody.get('name'), 'John Doe');
  assert.equal(capturedBody.get('email'), 'john@example.com');

  // Edge case: bot honeypot filled -> simulated success without external API call
  let honeypotCalled = false;
  const honeypotFetch: any = async () => {
    honeypotCalled = true;
    return { ok: true, json: async () => ({ success: true }) };
  };

  const botRes = await sendContactMessage(
    {
      name: 'Spam Bot',
      email: 'bot@spam.com',
      subject: 'Buy cheap watches',
      message: 'Click this link to buy cheap watches now!',
      botcheck: 'http://spam-link.ru',
    },
    'mock_key_123',
    honeypotFetch
  );

  assert.equal(botRes.success, true);
  assert.equal(honeypotCalled, false, 'Fetch must not be called when honeypot is triggered');

  // Edge case: missing access key
  const missingKeyRes = await sendContactMessage(
    {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Inquiry',
      message: 'This is a valid inquiry message.',
    },
    '',
    mockFetch
  );
  assert.equal(missingKeyRes.success, false);
  assert.ok(missingKeyRes.message.includes('not configured'));

  // Edge case: HTTP error response from server
  const serverErrorFetch: any = async () => ({
    ok: false,
    status: 500,
  });
  const errRes = await sendContactMessage(
    {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Inquiry',
      message: 'This is a valid inquiry message.',
    },
    'mock_key_123',
    serverErrorFetch
  );
  assert.equal(errRes.success, false);
  assert.ok(errRes.message.includes('500'));
});

test('Web3Forms: access key is never hardcoded in tracked source code', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const filesToCheck = [
    'src/lib/contact/web3forms.ts',
    'src/components/help/ContactSupportSection.tsx',
    'src/pages/HelpPage.tsx',
    '.env.example',
  ];

  const secretPattern = new RegExp(['b06ed6', '27-495d', '-4104', '-a72e', '-a92b92f76cd9'].join(''), 'i');

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.equal(
        secretPattern.test(content),
        false,
        `Secret access key must NEVER be hardcoded in tracked file: ${relPath}`
      );
    }
  }
});

