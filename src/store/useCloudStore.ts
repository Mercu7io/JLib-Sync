/**
 * Panda JWL-Sync — Zustand Store for Cloud Sync (Google Drive)
 */

import { create } from 'zustand';
import { driveManager, IDriveFile, getLocalDeviceId, getLocalDeviceName } from '../lib/cloud/googleDrive';
import { useAppStore } from './useAppStore';
import { packageJwLibrary } from '../lib/jw/zip';
import { CloudCrypto } from '../lib/cloud/crypto';
import { exportDatabase } from '../lib/jw/sqlite';
import { computeSha256 } from '../lib/jw/hash';

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
  statusMessage: string;
  error: string | null;
  showCloudModal: boolean;

  // Actions
  initCloud: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;
  refreshBackups: () => Promise<void>;
  backupCurrentLibrary: (customName?: string, onProgress?: (percent: number) => void) => Promise<void>;
  backupFileDirectly: (blobOrFile: Blob | File, fileName: string, sha256?: string, onProgress?: (percent: number) => void) => Promise<void>;
  restoreCloudBackup: (fileId: string, fileName: string) => Promise<void>;
  renameCloudBackup: (fileId: string, newName: string) => Promise<void>;
  deleteCloudBackup: (fileId: string) => Promise<void>;
  batchDeleteBackups: (fileIds: string[]) => Promise<void>;
  downloadCloudFile: (fileId: string, fileName: string) => Promise<File>;
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
  statusMessage: '',
  error: null,
  showCloudModal: false,
  ...loadEncryptionConfig(),

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
      set({ isUploading: true, statusMessage: 'Preparing backup for Google Drive...' });
      const {
        activeDb,
        activeLibraryBytes,
        activeManifest,
        activeSha256,
        extraFiles,
        activeLibraryFile,
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

      set({ statusMessage: 'Uploading to Google Drive (0%)...' });
      onProgress?.(0);
      await driveManager.uploadBackup(
        name,
        blob,
        {
          sha256: currentSha256 || undefined,
          deviceId: getLocalDeviceId(),
          deviceName: getLocalDeviceName(),
        },
        (percent) => {
          set({ statusMessage: `Uploading to Google Drive (${percent}%)...` });
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
      set({ isUploading: false, statusMessage: 'Backup uploaded successfully!' });
      setTimeout(() => set({ statusMessage: '' }), 4000);
    } catch (err) {
      set({ isUploading: false, error: (err as Error).message, statusMessage: '' });
      throw err;
    }
  },

  backupFileDirectly: async (
    blobOrFile: Blob | File,
    fileName: string,
    sha256?: string,
    onProgress?: (percent: number) => void
  ) => {
    try {
      set({ isUploading: true, statusMessage: 'Uploading to Google Drive...' });
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

      set({ statusMessage: 'Uploading to Google Drive (0%)...' });
      onProgress?.(0);
      await driveManager.uploadBackup(
        name,
        blob,
        {
          sha256: sha256 || undefined,
          deviceId: getLocalDeviceId(),
          deviceName: getLocalDeviceName(),
        },
        (percent) => {
          set({ statusMessage: `Uploading to Google Drive (${percent}%)...` });
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
      set({ isUploading: false, statusMessage: 'Backup uploaded successfully!' });
      setTimeout(() => set({ statusMessage: '' }), 4000);
    } catch (err) {
      set({ isUploading: false, error: (err as Error).message, statusMessage: '' });
      throw err;
    }
  },

  restoreCloudBackup: async (fileId: string, fileName: string) => {
    try {
      set({ isLoading: true, statusMessage: `Downloading "${fileName}" from Google Drive...` });
      let dataBuffer: ArrayBuffer | Uint8Array = await driveManager.downloadBackup(fileId);

      if (fileName.endsWith('.enc')) {
        const { encryptionPassword } = get();
        if (!encryptionPassword) {
          set({ isLoading: false, statusMessage: '' });
          throw new Error('PASSWORD_REQUIRED');
        }
        set({ statusMessage: 'Decrypting backup...' });
        const crypto = new CloudCrypto();
        dataBuffer = await crypto.decrypt(dataBuffer, encryptionPassword);
      }

      const blob = new Blob([dataBuffer as any], { type: 'application/zip' });
      // Load into main app store in-memory
      await useAppStore.getState().loadLibrary(blob, fileName.replace(/\.enc$/, ''));
      set({ isLoading: false, statusMessage: '', showCloudModal: false });
    } catch (err) {
      set({ isLoading: false, statusMessage: '', error: (err as Error).message });
      throw err;
    }
  },

  downloadCloudFile: async (fileId: string, fileName: string): Promise<File> => {
    let dataBuffer: ArrayBuffer | Uint8Array = await driveManager.downloadBackup(fileId);
    if (fileName.endsWith('.enc')) {
      const { encryptionPassword } = get();
      if (!encryptionPassword) {
        throw new Error('PASSWORD_REQUIRED');
      }
      const crypto = new CloudCrypto();
      dataBuffer = await crypto.decrypt(dataBuffer, encryptionPassword);
      fileName = fileName.replace(/\.enc$/, '');
    }
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
