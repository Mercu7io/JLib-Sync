/**
 * Panda JL Studio — Global Zustand Store (useAppStore.ts)
 * Holds the active .jwlibrary in-memory for instant switching across
 * Landing, Merge, Explorer, Stats, and Share views.
 */

import { create } from 'zustand';
import { Database } from 'sql.js';
import { IManifest, ILibrarySummary } from '../lib/jw/types';
import { extractJwLibrary } from '../lib/jw/zip';
import { openDatabase, getLibrarySummary } from '../lib/jw/sqlite';
import { computeSha256 } from '../lib/jw/hash';

import i18n, { getInitialLanguage } from '../i18n';

interface IAppState {
  activeLibraryFile: File | Blob | null;
  activeLibraryBytes: Uint8Array | null;
  activeManifest: IManifest | null;
  activeDb: Database | null;
  activeSha256: string | null;
  extraFiles: Map<string, Uint8Array>;
  summary: ILibrarySummary | null;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  selectedLanguage: string;

  // Actions
  loadLibrary: (fileOrBlob: File | Blob, customName?: string) => Promise<void>;
  loadDemoLibrary: (demoKey?: any) => Promise<void>;
  closeLibrary: () => void;
  updateActiveDatabase: (
    dbBytes: Uint8Array,
    manifest?: IManifest,
    extraFiles?: Map<string, Uint8Array>,
    fileOrBlob?: File | Blob
  ) => Promise<void>;
  setIsLoading: (loading: boolean, message?: string) => void;
  setSelectedLanguage: (lang: string) => void;
  clearError: () => void;
}

export const useAppStore = create<IAppState>((set, get) => ({
  activeLibraryFile: null,
  activeLibraryBytes: null,
  activeManifest: null,
  activeDb: null,
  activeSha256: null,
  extraFiles: new Map(),
  summary: null,
  isLoading: false,
  loadingMessage: '',
  error: null,
  selectedLanguage: getInitialLanguage(),

  setIsLoading: (loading: boolean, message?: string) => {
    set({
      isLoading: loading,
      loadingMessage: loading ? (message || '') : '',
    });
  },

  loadLibrary: async (fileOrBlob: File | Blob, customName?: string) => {
    try {
      set({ isLoading: true, loadingMessage: 'Unpacking .jwlibrary archive (10%)...', error: null });

      const name = customName || (fileOrBlob instanceof File ? fileOrBlob.name : 'backup.jwlibrary');
      const { manifest, dbBytes, fileSizeBytes, extraFiles } = await extractJwLibrary(
        fileOrBlob,
        name,
        (p) => {
          set({ loadingMessage: `${p.stage} (${p.percent}%)` });
        }
      );

      set({ loadingMessage: 'Initializing SQLite WebAssembly (96%)...' });
      const db = await openDatabase(dbBytes);

      // Free previous database if any
      const prevDb = get().activeDb;
      if (prevDb && prevDb !== db) {
        try {
          prevDb.close();
        } catch (_) {}
      }

      const summary = getLibrarySummary(db, manifest, fileSizeBytes);
      const activeSha256 = await computeSha256(dbBytes);

      set({
        activeLibraryFile: fileOrBlob,
        activeLibraryBytes: dbBytes,
        activeManifest: manifest,
        activeDb: db,
        activeSha256,
        extraFiles,
        summary,
        isLoading: false,
        loadingMessage: '',
      });
    } catch (err) {
      set({
        isLoading: false,
        loadingMessage: '',
        error: (err as Error).message || 'Failed to load .jwlibrary file.',
      });
      throw err;
    }
  },

  loadDemoLibrary: async (demoKey?: any) => {
    try {
      const key = (typeof demoKey === 'string' && demoKey === 'example') ? 'example' : 'example2';
      set({ isLoading: true, loadingMessage: 'Loading demo library...', error: null });
      const filename = key === 'example2' ? '/example2.jwlibrary' : '/example.jwlibrary';
      const label = key === 'example2' ? 'Example 2 (2026 Mendelevium v16)' : 'Example 1 (2025 Mendelevium v14)';

      const res = await fetch(filename);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${filename}: HTTP ${res.status}`);
      }
      const blob = await res.blob();
      await get().loadLibrary(blob, label);
    } catch (err) {
      set({
        isLoading: false,
        loadingMessage: '',
        error: (err as Error).message || 'Failed to load demo library.',
      });
    }
  },

  closeLibrary: () => {
    const prevDb = get().activeDb;
    if (prevDb) {
      try {
        prevDb.close();
      } catch (_) {}
    }
    set({
      activeLibraryFile: null,
      activeLibraryBytes: null,
      activeManifest: null,
      activeDb: null,
      activeSha256: null,
      extraFiles: new Map(),
      summary: null,
      error: null,
    });
  },

  updateActiveDatabase: async (
    dbBytes: Uint8Array,
    manifest?: IManifest,
    extraFiles?: Map<string, Uint8Array>,
    fileOrBlob?: File | Blob
  ) => {
    try {
      set({ isLoading: true, loadingMessage: 'Reloading updated database...' });
      const newDb = await openDatabase(dbBytes);
      const prevDb = get().activeDb;
      if (prevDb) {
        try {
          prevDb.close();
        } catch (_) {}
      }

      const finalManifest = manifest || get().activeManifest;
      if (!finalManifest) {
        throw new Error('No active manifest to update.');
      }

      const finalExtraFiles = extraFiles !== undefined ? extraFiles : get().extraFiles;
      const finalFileOrBlob = fileOrBlob !== undefined ? fileOrBlob : get().activeLibraryFile;
      const sizeBytes = finalFileOrBlob
        ? (finalFileOrBlob instanceof File ? finalFileOrBlob.size : finalFileOrBlob.size)
        : dbBytes.byteLength;

      const summary = getLibrarySummary(newDb, finalManifest, sizeBytes);
      const activeSha256 = await computeSha256(dbBytes);

      set({
        activeLibraryFile: finalFileOrBlob,
        activeLibraryBytes: dbBytes,
        activeDb: newDb,
        activeManifest: finalManifest,
        activeSha256,
        extraFiles: finalExtraFiles,
        summary,
        isLoading: false,
        loadingMessage: '',
      });
    } catch (err) {
      set({
        isLoading: false,
        loadingMessage: '',
        error: (err as Error).message,
      });
    }
  },

  setSelectedLanguage: (lang: string) => {
    try {
      localStorage.setItem('jlib_language', lang);
      i18n.changeLanguage(lang);
    } catch (_) {}
    set({ selectedLanguage: lang });
  },
  clearError: () => set({ error: null }),
}));
