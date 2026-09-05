/**
 * Panda JWL-Sync — Zustand Store for Cloud Sync (Google Drive)
 */

import { create } from 'zustand';
import { driveManager, IDriveFile, getLocalDeviceId, getLocalDeviceName } from '../lib/cloud/googleDrive.ts';
import { useAppStore } from './useAppStore.ts';
import { packageJwLibrary } from '../lib/jw/zip.ts';
import { CloudCrypto } from '../lib/cloud/crypto.ts';
import { exportDatabase } from '../lib/jw/sqlite.ts';
import { computeSha256 } from '../lib/jw/hash.ts';
import { analyzeJwLibraryFile } from '../lib/jw/archiveAnalysis.ts';

interface ICloudState {
  isConnected: boolean;
  isSessionExpired: boolean;
  isOnline: boolean;
  backups: IDriveFile[];
  knownCloudShas: string[];
  unreadCloudBackupsCount: number;
  unseenBackups: IDriveFile[];
  deviceSyncNotificationsEnabled: boolean;
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number | null;
  downloadProgress: number | null;
  cachedEncryptedDownload: { fileId: string; fileName: string; buffer: ArrayBuffer } | null;
  statusMessage: string;
  error: string | null;
  showCloudModal: boolean;

  // Actions
  initCloud: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;
  refreshBackups: () => Promise<void>;
  backupCurrentLibrary: (customName?: string, onProgress?: (percent: number) => void) => Promise<void>;
  backupFileDirectly: (
    blobOrFile: Blob | File,
    fileName: string,
    sha256?: string,
    onProgress?: (percent: number) => void,
    summary?: { notesCount?: number; tagsCount?: number; playlistsCount?: number; bookmarksCount?: number }
  ) => Promise<void>;
  uploadCustomFile: (
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<void>;
  restoreCloudBackup: (fileId: string, fileName: string, overridePassword?: string, onProgress?: (pct: number) => void) => Promise<void>;
  renameCloudBackup: (fileId: string, newName: string) => Promise<void>;
  deleteCloudBackup: (fileId: string) => Promise<void>;
  batchDeleteBackups: (fileIds: string[]) => Promise<void>;
  downloadCloudFile: (fileId: string, fileName: string, onProgress?: (pct: number) => void, overridePassword?: string) => Promise<File>;
  clearCachedEncryptedDownload: () => void;
  setShowCloudModal: (show: boolean) => void;
  clearError: () => void;
  setDeviceSyncNotificationsEnabled: (enabled: boolean) => void;
  acknowledgeCloudBackups: () => void;
  isShaInCloud: (sha?: string | null) => boolean;

  // Encryption
  encryptionEnabled: boolean;
  encryptionPassword: null | string;
  passwordExpiresAt: null | number;
  setEncryptionConfig: (enabled: boolean, password: null | string, expiresInMs?: number) => void;
}

const LOCAL_STORAGE_ENC_KEY = 'jwsync_cloud_enc';
const LOCAL_STORAGE_NOTIFS_KEY = 'jwsync_cloud_notifications';
const LOCAL_STORAGE_SHAS_KEY = 'jwsync_cloud_known_shas';

const loadCachedShas = (): string[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SHAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string');
    }
  } catch (_) {}
  return [];
};

const loadEncryptionConfig = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ENC_KEY);
    if (!raw) return { encryptionEnabled: false, encryptionPassword: null, passwordExpiresAt: null };
    const parsed = JSON.parse(raw);
    if (parsed.passwordExpiresAt && Date.now() > parsed.passwordExpiresAt) {
      return { encryptionEnabled: parsed.encryptionEnabled, encryptionPassword: null, passwordExpiresAt: null };
    }
    return {
      encryptionEnabled: !!parsed.encryptionEnabled,
      encryptionPassword: parsed.encryptionPassword || null,
      passwordExpiresAt: parsed.passwordExpiresAt || null,
    };
  } catch {
    return { encryptionEnabled: false, encryptionPassword: null, passwordExpiresAt: null };
  }
};

const getInitialNotificationsEnabled = () => {
  try {
    return localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const useCloudStore = create<ICloudState>((set, get) => ({
  isConnected: false,
  isSessionExpired: driveManager.isSessionExpired(),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  backups: [],
  knownCloudShas: loadCachedShas(),
  unreadCloudBackupsCount: 0,
  unseenBackups: [],
  deviceSyncNotificationsEnabled: getInitialNotificationsEnabled(),
  isLoading: false,
  isUploading: false,
  uploadProgress: null,
  downloadProgress: null,
  cachedEncryptedDownload: null,
  statusMessage: '',
  error: null,
  showCloudModal: false,
  ...loadEncryptionConfig(),

  clearCachedEncryptedDownload: () => set({ cachedEncryptedDownload: null }),

  setEncryptionConfig: (enabled: boolean, password: null | string, expiresInMs?: number) => {
    const passwordExpiresAt = expiresInMs ? Date.now() + expiresInMs : null;
    const config = { encryptionEnabled: enabled, encryptionPassword: password, passwordExpiresAt };
    localStorage.setItem(LOCAL_STORAGE_ENC_KEY, JSON.stringify(config));
    set(config);
  },

  setDeviceSyncNotificationsEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, enabled ? 'true' : 'false');
    } catch (_) {}
    set((state) => ({
      deviceSyncNotificationsEnabled: enabled,
      unreadCloudBackupsCount: enabled ? state.unseenBackups.length : 0,
    }));
  },

  acknowledgeCloudBackups: () => {
    try {
      localStorage.setItem('jwsync_last_ack_cloud_time', Date.now().toString());
    } catch (_) {}
    set({ unreadCloudBackupsCount: 0, unseenBackups: [] });
  },

  isShaInCloud: (sha?: string | null) => {
    if (!sha) return false;
    return get().knownCloudShas.includes(sha);
  },

  initCloud: async () => {
    if (typeof window !== 'undefined' && !(window as any).__JWSYNC_NET_INIT__) {
      (window as any).__JWSYNC_NET_INIT__ = true;
      window.addEventListener('online', () => set({ isOnline: true }));
      window.addEventListener('offline', () => set({ isOnline: false }));
    }
    try {
      await driveManager.init(
        async () => {
          set({ isConnected: true, isSessionExpired: false, error: null });
          await get().refreshBackups();
        },
        () => {
          set({ isConnected: false, isSessionExpired: true });
        }
      );
    } catch (err) {
      console.warn('Cloud init error:', err);
    }
  },

  connect: async () => {
    try {
      set({ error: null });
      await driveManager.login(async () => {
        set({ isConnected: true, isSessionExpired: false, error: null });
        await get().refreshBackups();
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  disconnect: () => {
    driveManager.logout();
    set({
      isConnected: false,
      isSessionExpired: false,
      backups: [],
      knownCloudShas: [],
      unreadCloudBackupsCount: 0,
      unseenBackups: [],
    });
  },

  refreshBackups: async () => {
    if (!driveManager.isConnected()) return;
    try {
      set({ isLoading: true, statusMessage: 'Listing cloud backups...' });
      const backups = await driveManager.listBackups();
      const shas = backups.map((b) => b.sha256).filter(Boolean) as string[];

      // Multi-device notification check
      const myDeviceId = getLocalDeviceId();
      let lastAckTime = 0;
      try {
        lastAckTime = Number(localStorage.getItem('jwsync_last_ack_cloud_time') || 0);
      } catch (_) {}

      const unseen = backups.filter((b) => {
        if (!b.deviceId || b.deviceId === myDeviceId) return false;
        const time = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return time > lastAckTime;
      });

      const notifsEnabled = get().deviceSyncNotificationsEnabled;

      try {
        localStorage.setItem(LOCAL_STORAGE_SHAS_KEY, JSON.stringify(shas));
      } catch (_) {}

      set({
        backups,
        knownCloudShas: shas,
        unseenBackups: unseen,
        unreadCloudBackupsCount: notifsEnabled ? unseen.length : 0,
        isLoading: false,
        statusMessage: '',
      });
    } catch (err: any) {
      const isExp = err?.message?.includes('Session expired');
      set({
        isLoading: false,
        statusMessage: '',
        error: isExp ? null : (err as Error).message,
        ...(isExp ? { isConnected: false, isSessionExpired: true } : {}),
      });
    }
  },
    backupCurrentLibrary: async (customName?: string, onProgress?: (percent: number) => void) => {
    try {
      set({ isUploading: true, uploadProgress: 0, statusMessage: 'Preparing backup for Google Drive...' });
      const {
        activeDb,
        activeLibraryBytes,
        activeManifest,
        activeSha256,
        extraFiles,
        activeLibraryFile,
        summary,
      } = useAppStore.getState();

      if ((!activeLibraryBytes && !activeDb) || !activeManifest) {
        throw new Error('No active library loaded to backup.');
      }

      const currentDbBytes = activeDb ? exportDatabase(activeDb) : activeLibraryBytes!;
      const currentSha256 = await computeSha256(currentDbBytes);

      const defaultName = activeManifest.name
        ? `${activeManifest.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Backup.jwlibrary`
        : 'JWLibrary_Backup.jwlibrary';
      let name = customName ? (customName.endsWith('.jwlibrary') ? customName : `${customName}.jwlibrary`) : defaultName;

      let blob: Blob;
      // If we already have the complete File/Blob and the database hasn't been modified:
      if (activeLibraryFile && activeSha256 === currentSha256) {
        blob = activeLibraryFile;
      } else {
        set({ statusMessage: 'Packaging .jwlibrary archive...' });
        blob = await packageJwLibrary(
          currentDbBytes,
          activeManifest,
          extraFiles,
          (pct) => {
            set({ statusMessage: `Packaging archive (${Math.round(pct)}%)...` });
          }
        );
      }

      const { encryptionEnabled, encryptionPassword } = get();
      if (encryptionEnabled) {
        if (!encryptionPassword) throw new Error('Encryption is enabled but no password is set.');
        set({ statusMessage: 'Encrypting backup (AES-256)...' });
        const crypto = new CloudCrypto();
        const arrayBuffer = await blob.arrayBuffer();
        const encryptedBytes = await crypto.encrypt(arrayBuffer, encryptionPassword);
        blob = new Blob([encryptedBytes as any], { type: 'application/octet-stream' });
        if (!name.endsWith('.enc')) name += '.enc';
      }

      if (!driveManager.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          driveManager.login(async () => {
            set({ isConnected: true, isSessionExpired: false, error: null });
            resolve();
          }).catch(reject);
        });
      }

      set({ uploadProgress: 0, statusMessage: 'Uploading to Google Drive (0%)...' });
      onProgress?.(0);
      await driveManager.uploadBackup(
        name,
        blob,
        {
          sha256: currentSha256 || undefined,
          deviceId: getLocalDeviceId(),
          deviceName: getLocalDeviceName(),
          notesCount: summary?.notesCount,
          tagsCount: summary?.tagsCount,
          playlistsCount: summary?.playlistsCount,
          bookmarksCount: summary?.bookmarksCount,
        },
        (percent) => {
          set({ uploadProgress: percent, statusMessage: `Uploading to Google Drive (${percent}%)...` });
          onProgress?.(percent);
        }
      );

      if (currentSha256) {
        const updatedShas = Array.from(new Set([...get().knownCloudShas, currentSha256]));
        try {
          localStorage.setItem(LOCAL_STORAGE_SHAS_KEY, JSON.stringify(updatedShas));
        } catch (_) {}
        set({ knownCloudShas: updatedShas });
      }

      await get().refreshBackups();
      set({ isUploading: false, uploadProgress: null, statusMessage: 'Backup uploaded successfully!' });
      setTimeout(() => set({ statusMessage: '' }), 4000);
    } catch (err) {
      set({ isUploading: false, uploadProgress: null, error: (err as Error).message, statusMessage: '' });
      throw err;
    }
  },

  backupFileDirectly: async (
    blobOrFile: Blob | File,
    fileName: string,
    sha256?: string,
    onProgress?: (percent: number) => void,
    summary?: { notesCount?: number; tagsCount?: number; playlistsCount?: number; bookmarksCount?: number }
  ) => {
    try {
      set({ isUploading: true, uploadProgress: 0, statusMessage: 'Uploading to Google Drive (0%)...' });
      let blob: Blob = blobOrFile;
      let name = fileName.endsWith('.jwlibrary') ? fileName : `${fileName}.jwlibrary`;

      const { encryptionEnabled, encryptionPassword } = get();
      if (encryptionEnabled) {
        if (!encryptionPassword) throw new Error('Encryption is enabled but no password is set.');
        set({ statusMessage: 'Encrypting backup (AES-256)...' });
        const crypto = new CloudCrypto();
        const arrayBuffer = await blob.arrayBuffer();
        const encryptedBytes = await crypto.encrypt(arrayBuffer, encryptionPassword);
        blob = new Blob([encryptedBytes as any], { type: 'application/octet-stream' });
        if (!name.endsWith('.enc')) name += '.enc';
      }

      if (!driveManager.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          driveManager.login(async () => {
            set({ isConnected: true, isSessionExpired: false, error: null });
            resolve();
          }).catch(reject);
        });
      }

      set({ uploadProgress: 0, statusMessage: 'Uploading to Google Drive (0%)...' });
      onProgress?.(0);
      await driveManager.uploadBackup(
        name,
        blob,
        {
          sha256: sha256 || undefined,
          deviceId: getLocalDeviceId(),
          deviceName: getLocalDeviceName(),
          notesCount: summary?.notesCount,
          tagsCount: summary?.tagsCount,
          playlistsCount: summary?.playlistsCount,
          bookmarksCount: summary?.bookmarksCount,
        },
        (percent) => {
          set({ uploadProgress: percent, statusMessage: `Uploading to Google Drive (${percent}%)...` });
          onProgress?.(percent);
        }
      );

      if (sha256) {
        const updatedShas = Array.from(new Set([...get().knownCloudShas, sha256]));
        try {
          localStorage.setItem(LOCAL_STORAGE_SHAS_KEY, JSON.stringify(updatedShas));
        } catch (_) {}
        set({ knownCloudShas: updatedShas });
      }

      await get().refreshBackups();
      set({ isUploading: false, uploadProgress: null, statusMessage: 'Backup uploaded successfully!' });
      setTimeout(() => set({ statusMessage: '' }), 4000);
    } catch (err) {
      set({ isUploading: false, uploadProgress: null, error: (err as Error).message, statusMessage: '' });
      throw err;
    }
  },

  uploadCustomFile: async (file: File, onProgress?: (percent: number) => void) => {
    try {
      set({ isUploading: true, uploadProgress: 0, statusMessage: 'Analyzing .jwlibrary file...' });

      let summary: { notesCount?: number; tagsCount?: number; playlistsCount?: number; bookmarksCount?: number } | undefined;
      let sha256: string | undefined;

      try {
        const analysis = await analyzeJwLibraryFile(file);
        if (analysis) {
          sha256 = analysis.sha256;
          summary = {
            notesCount: analysis.notesCount,
            tagsCount: analysis.tagsCount,
            playlistsCount: analysis.playlistsCount,
            bookmarksCount: analysis.bookmarksCount,
          };
        }
      } catch (analysisErr) {
        console.warn('Could not analyze .jwlibrary file before upload:', analysisErr);
      }

      await get().backupFileDirectly(file, file.name, sha256, onProgress, summary);
    } catch (err) {
      set({ isUploading: false, uploadProgress: null, error: (err as Error).message, statusMessage: '' });
      throw err;
    }
  },

  restoreCloudBackup: async (
    fileId: string,
    fileName: string,
    overridePassword?: string,
    onProgress?: (pct: number) => void
  ) => {
    try {
      const isEncrypted = fileName.endsWith('.enc');
      const effectivePassword = overridePassword || get().encryptionPassword;

      // 1. Password check BEFORE downloading
      if (isEncrypted && !effectivePassword) {
        set({ isLoading: false, statusMessage: '' });
        throw new Error('PASSWORD_REQUIRED');
      }

      set({ isLoading: true, statusMessage: `Downloading "${fileName}" from Google Drive (0%)...`, downloadProgress: 0 });

      let dataBuffer: ArrayBuffer | Uint8Array;
      const cached = get().cachedEncryptedDownload;

      // Check if we already have the raw encrypted bytes cached in memory
      if (isEncrypted && cached && cached.fileId === fileId) {
        dataBuffer = cached.buffer;
      } else {
        dataBuffer = await driveManager.downloadBackup(fileId, (pct) => {
          set({
            downloadProgress: pct,
            statusMessage: `Downloading "${fileName}" (${pct}%)...`,
          });
          onProgress?.(pct);
        });
      }
      set({ downloadProgress: 100 });

      if (isEncrypted) {
        try {
          set({ statusMessage: 'Decrypting backup...' });
          const crypto = new CloudCrypto();
          dataBuffer = await crypto.decrypt(dataBuffer, effectivePassword!);
          // Clear cached encrypted download on successful decryption
          set({ cachedEncryptedDownload: null });
        } catch (decryptErr) {
          // Keep the downloaded encrypted bytes in memory so the user doesn't have to re-download!
          set({
            cachedEncryptedDownload: { fileId, fileName, buffer: dataBuffer as ArrayBuffer },
            isLoading: false,
            downloadProgress: null,
            statusMessage: '',
          });
          throw decryptErr;
        }
      }

      const blob = new Blob([dataBuffer as any], { type: 'application/zip' });
      const cleanFileName = fileName.replace(/\.enc$/, '');

      // Close cloud download modal immediately before decompression begins so user sees progress on page
      set({
        showCloudModal: false,
        isLoading: false,
        downloadProgress: null,
        statusMessage: '',
      });

      // Load into main app store in-memory (decompresses SQLite and parses manifest)
      await useAppStore.getState().loadLibrary(blob, cleanFileName);
    } catch (err) {
      set({ isLoading: false, downloadProgress: null, statusMessage: '', error: (err as Error).message });
      throw err;
    }
  },

  downloadCloudFile: async (
    fileId: string,
    fileName: string,
    onProgress?: (pct: number) => void,
    overridePassword?: string
  ): Promise<File> => {
    const isEncrypted = fileName.endsWith('.enc');
    const effectivePassword = overridePassword || get().encryptionPassword;

    // 1. Password check BEFORE downloading
    if (isEncrypted && !effectivePassword) {
      throw new Error('PASSWORD_REQUIRED');
    }

    set({ downloadProgress: 0 });

    let dataBuffer: ArrayBuffer | Uint8Array;
    const cached = get().cachedEncryptedDownload;

    if (isEncrypted && cached && cached.fileId === fileId) {
      dataBuffer = cached.buffer;
    } else {
      dataBuffer = await driveManager.downloadBackup(fileId, (pct) => {
        set({ downloadProgress: pct });
        onProgress?.(pct);
      });
    }
    set({ downloadProgress: 100 });

    if (isEncrypted) {
      try {
        const crypto = new CloudCrypto();
        dataBuffer = await crypto.decrypt(dataBuffer, effectivePassword!);
        set({ cachedEncryptedDownload: null });
      } catch (decryptErr) {
        // Cache encrypted bytes in memory to avoid re-downloading on password re-entry
        set({
          cachedEncryptedDownload: { fileId, fileName, buffer: dataBuffer as ArrayBuffer },
          downloadProgress: null,
        });
        throw decryptErr;
      }
      fileName = fileName.replace(/\.enc$/, '');
    }

    set({ downloadProgress: null });
    return new File([dataBuffer as any], fileName, { type: 'application/zip' });
  },

  renameCloudBackup: async (fileId: string, newName: string) => {
    try {
      set({ isLoading: true, statusMessage: `Renaming "${newName}"...` });
      await driveManager.renameBackup(fileId, newName);
      await get().refreshBackups();
      set({ isLoading: false, statusMessage: '' });
    } catch (err) {
      set({ isLoading: false, statusMessage: '', error: (err as Error).message });
      throw err;
    }
  },

  deleteCloudBackup: async (fileId: string) => {
    try {
      set({ isLoading: true });
      await driveManager.deleteBackup(fileId);
      await get().refreshBackups();
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  batchDeleteBackups: async (fileIds: string[]) => {
    try {
      set({ isLoading: true, statusMessage: `Deleting ${fileIds.length} file(s)...` });
      await driveManager.batchDeleteBackups(fileIds);
      await get().refreshBackups();
      set({ isLoading: false, statusMessage: '' });
    } catch (err) {
      set({ isLoading: false, statusMessage: '', error: (err as Error).message });
    }
  },

  setShowCloudModal: (show: boolean) => set({ showCloudModal: show }),
  clearError: () => set({ error: null }),
}));
