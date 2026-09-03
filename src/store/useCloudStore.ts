/**
 * Panda JWL-Sync — Zustand Store for Cloud Sync (Google Drive)
 */

import { create } from 'zustand';
import { driveManager, IDriveFile } from '../lib/cloud/googleDrive';
import { useAppStore } from './useAppStore';
import { packageJwLibrary } from '../lib/jw/zip';
import { CloudCrypto } from '../lib/cloud/crypto';

interface ICloudState {
  isConnected: boolean;
  backups: IDriveFile[];
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
  backupCurrentLibrary: (customName?: string) => Promise<void>;
  restoreCloudBackup: (fileId: string, fileName: string) => Promise<void>;
  deleteCloudBackup: (fileId: string) => Promise<void>;
  batchDeleteBackups: (fileIds: string[]) => Promise<void>;
  downloadCloudFile: (fileId: string, fileName: string) => Promise<File>;
  setShowCloudModal: (show: boolean) => void;
  clearError: () => void;

  // Encryption
  encryptionEnabled: boolean;
  encryptionPassword: null | string;
  passwordExpiresAt: null | number;
  setEncryptionConfig: (enabled: boolean, password: null | string, expiresInMs?: number) => void;
}

const LOCAL_STORAGE_ENC_KEY = 'jwsync_cloud_enc';

const loadEncryptionConfig = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ENC_KEY);
    if (!raw) return { encryptionEnabled: false, encryptionPassword: null, passwordExpiresAt: null };
    const parsed = JSON.parse(raw);
    if (parsed.passwordExpiresAt && Date.now() > parsed.passwordExpiresAt) {
      // Keep enabled state, but drop the expired password
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

export const useCloudStore = create<ICloudState>((set, get) => ({
  isConnected: false,
  backups: [],
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

  initCloud: async () => {
    try {
      await driveManager.init(async () => {
        set({ isConnected: true, error: null });
        await get().refreshBackups();
      });
      // driveManager.trySilentReconnect(); // Removed to prevent automatic popups on load
    } catch (err) {
      console.warn('Cloud init error:', err);
    }
  },

  connect: async () => {
    try {
      set({ error: null });
      await driveManager.login(async () => {
        set({ isConnected: true, error: null });
        await get().refreshBackups();
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  disconnect: () => {
    driveManager.logout();
    set({ isConnected: false, backups: [] });
  },

  refreshBackups: async () => {
    if (!driveManager.isConnected()) return;
    try {
      set({ isLoading: true, statusMessage: 'Listing cloud backups...' });
      const backups = await driveManager.listBackups();
      set({ backups, isLoading: false, statusMessage: '' });
    } catch (err) {
      set({ isLoading: false, statusMessage: '', error: (err as Error).message });
    }
  },



  backupCurrentLibrary: async (customName?: string) => {
    const { activeLibraryBytes, activeManifest, summary, extraFiles } = useAppStore.getState();
    if (!activeLibraryBytes || !activeManifest) {
      throw new Error('No active library loaded to backup.');
    }

    try {
      set({ isUploading: true, statusMessage: 'Packaging .jwlibrary...' });
      let blob = await packageJwLibrary(activeLibraryBytes, activeManifest, extraFiles);
      let name =
        customName ||
        `${(summary?.name || 'JWL_Backup').replace(/[^a-z0-9_\-]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.jwlibrary`;

      const { encryptionEnabled, encryptionPassword } = get();
      if (encryptionEnabled) {
        if (!encryptionPassword) throw new Error('Encryption is enabled but no password is set.');
        set({ statusMessage: 'Encrypting backup (AES-256)...' });
        const crypto = new CloudCrypto();
        const arrayBuffer = await blob.arrayBuffer();
        const encryptedBytes = await crypto.encrypt(arrayBuffer, encryptionPassword);
        blob = new Blob([encryptedBytes as any], { type: 'application/octet-stream' });
        name += '.enc';
      }

      set({ statusMessage: 'Uploading to Google Drive...' });
      await driveManager.uploadBackup(name, blob);
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
