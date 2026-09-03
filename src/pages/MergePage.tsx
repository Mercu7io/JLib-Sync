import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitMerge,
  Upload,
  CheckCircle2,
  Download,
  Compass,
  FileText,
  Cloud,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Smartphone,
  Tablet,
  X,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { extractJwLibrary } from '../lib/jw/zip';
import { openDatabase, getLibrarySummary, queryAll } from '../lib/jw/sqlite';
import { mergeJwLibraries, IMergeResult } from '../lib/jw/merge';
import { IManifest, ILibrarySummary, IMergeProgress, TagManagerMap } from '../lib/jw/types';
import { useAppStore } from '../store/useAppStore';
import { useCloudStore } from '../store/useCloudStore';
import { IDriveFile } from '../lib/cloud/googleDrive';

interface ILoadedFileState {
  file: File;
  dbBytes: Uint8Array;
  manifest: IManifest;
  summary: ILibrarySummary;
  extraFiles: Map<string, Uint8Array>;
}

interface IConflictItem {
  id: string;
  verseAnchor: string;
  sourceAText: string;
  sourceBText: string;
  choice: 'both' | 'a' | 'b';
}

export const MergePage: React.FC = () => {
  const navigate = useNavigate();
  const { updateActiveDatabase } = useAppStore();
  const {
    isConnected,
    backups,
    refreshBackups,
    connect,
    downloadCloudFile,
    backupCurrentLibrary,
    isUploading,
  } = useCloudStore();

  const [primaryFile, setPrimaryFile] = useState<ILoadedFileState | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<ILoadedFileState | null>(null);
  const [outputName, setOutputName] = useState<string>('Merge_Merged_Study.jwlibrary');

  // Conflict Resolution State
  const [conflicts, setConflicts] = useState<IConflictItem[]>([]);

  // Cloud Picker State
  const [cloudPickerTarget, setCloudPickerTarget] = useState<'primary' | 'secondary' | null>(null);
  const [isDownloadingCloud, setIsDownloadingCloud] = useState<boolean>(false);

  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeProgress, setMergeProgress] = useState<IMergeProgress | null>(null);
  const [mergeResult, setMergeResult] = useState<IMergeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cloudSaveSuccess, setCloudSaveSuccess] = useState<boolean>(false);

  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  // Check if preloaded from CloudSyncModal
  useEffect(() => {
    const preloaded = (window as any).__PANDA_PRELOAD_MERGE__;
    if (preloaded?.primary && preloaded?.secondary) {
      (async () => {
        try {
          await loadPrimary(preloaded.primary);
          await loadSecondary(preloaded.secondary);
          delete (window as any).__PANDA_PRELOAD_MERGE__;
        } catch (err) {
          setErrorMessage('Failed to load pre-selected cloud files: ' + (err as Error).message);
        }
      })();
    }
  }, []);

  const loadPrimary = async (file: File) => {
    setErrorMessage(null);
    const { manifest, dbBytes, fileSizeBytes, extraFiles } = await extractJwLibrary(file);
    const db = await openDatabase(dbBytes);
    const summary = getLibrarySummary(db, manifest, fileSizeBytes);
    db.close();

    setPrimaryFile({ file, dbBytes, manifest, summary, extraFiles });
    setOutputName(`Merge_${(manifest.name || 'Merged').replace(/[^a-z0-9_\-]/gi, '_')}.jwlibrary`);
  };

  const loadSecondary = async (file: File) => {
    setErrorMessage(null);
    const { manifest, dbBytes, fileSizeBytes, extraFiles } = await extractJwLibrary(file);
    const db = await openDatabase(dbBytes);
    const summary = getLibrarySummary(db, manifest, fileSizeBytes);
    db.close();

    setSecondaryFile({ file, dbBytes, manifest, summary, extraFiles });
  };

  // Inspect Potential Conflicts when both files are loaded
  useEffect(() => {
    if (!primaryFile || !secondaryFile) {
      setConflicts([]);
      return;
    }

    (async () => {
      try {
        const dbA = await openDatabase(primaryFile.dbBytes);
        const dbB = await openDatabase(secondaryFile.dbBytes);

        const notesA = queryAll<{ NoteId: number; LocationId: number; BlockIdentifier: number; Content: string; Title: string }>(
          dbA,
          'SELECT NoteId, LocationId, BlockIdentifier, Content, Title FROM Note WHERE Content IS NOT NULL'
        );
        const notesB = queryAll<{ NoteId: number; LocationId: number; BlockIdentifier: number; Content: string; Title: string }>(
          dbB,
          'SELECT NoteId, LocationId, BlockIdentifier, Content, Title FROM Note WHERE Content IS NOT NULL'
        );

        dbA.close();
        dbB.close();

        const detected: IConflictItem[] = [];
        notesA.forEach((nA) => {
          if (!nA.LocationId) return;
          const matchB = notesB.find(
            (nB) =>
              nB.LocationId === nA.LocationId &&
              nB.BlockIdentifier === nA.BlockIdentifier &&
              nB.Content !== nA.Content
          );
          if (matchB) {
            detected.push({
              id: `${nA.LocationId}_${nA.BlockIdentifier}`,
              verseAnchor: nA.Title || `Location #${nA.LocationId}`,
              sourceAText: nA.Content,
              sourceBText: matchB.Content,
              choice: 'both',
            });
          }
        });

        setConflicts(detected);
      } catch (_) {}
    })();
  }, [primaryFile, secondaryFile]);

  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadPrimary(file);
  };

  const handleSecondaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadSecondary(file);
  };

  const handleLoadDemoFiles = async () => {
    try {
      setErrorMessage(null);
      const [res1, res2] = await Promise.all([
        fetch('/example.jwlibrary'),
        fetch('/example2.jwlibrary'),
      ]);
      if (!res1.ok || !res2.ok) throw new Error('Could not fetch demo files');
      const [blob1, blob2] = await Promise.all([res1.blob(), res2.blob()]);

      const f1 = new File([blob1], 'Galaxy_Tab_Study.jwlibrary', { type: 'application/zip' });
      const f2 = new File([blob2], 'Pixel_Phone_Prep.jwlibrary', { type: 'application/zip' });

      await loadPrimary(f1);
      await loadSecondary(f2);
    } catch (err) {
      setErrorMessage('Could not load demo pair: ' + (err as Error).message);
    }
  };

  const handlePickFromCloud = async (target: 'primary' | 'secondary') => {
    if (!isConnected) {
      connect();
      return;
    }
    await refreshBackups();
    setCloudPickerTarget(target);
  };

  const handleSelectCloudBackup = async (b: IDriveFile) => {
    if (!cloudPickerTarget) return;
    try {
      setIsDownloadingCloud(true);
      const file = await downloadCloudFile(b.id, b.name);
      if (cloudPickerTarget === 'primary') {
        await loadPrimary(file);
      } else {
        await loadSecondary(file);
      }
      setIsDownloadingCloud(false);
      setCloudPickerTarget(null);
    } catch (err) {
      setIsDownloadingCloud(false);
      setErrorMessage('Failed to load cloud backup: ' + (err as Error).message);
    }
  };

  const handleExecuteMerge = async () => {
    if (!primaryFile || !secondaryFile) return;

    try {
      setIsMerging(true);
      setErrorMessage(null);
      setMergeResult(null);
      setCloudSaveSuccess(false);

      const tagRules: TagManagerMap = {};

      const result = await mergeJwLibraries(
        primaryFile.dbBytes,
        primaryFile.manifest,
        [
          {
            name: secondaryFile.file.name,
            dbBytes: secondaryFile.dbBytes,
            manifest: secondaryFile.manifest,
            extraFiles: secondaryFile.extraFiles,
          },
        ],
        {
          primaryName: outputName.replace(/\.jwlibrary$/i, ''),
          doctorCheck: true,
        },
        tagRules,
        (p) => setMergeProgress(p),
        primaryFile.extraFiles
      );

      setMergeResult(result);
      setIsMerging(false);
    } catch (err: any) {
      setIsMerging(false);
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : (err?.message || JSON.stringify(err)));
      setErrorMessage(`Merge failed: ${msg}`);
    }
  };

  const handleDownload = () => {
    if (!mergeResult) return;
    const url = URL.createObjectURL(mergeResult.mergedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputName.endsWith('.jwlibrary') ? outputName : `${outputName}.jwlibrary`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInExplorer = async () => {
    if (!mergeResult) return;
    await updateActiveDatabase(mergeResult.mergedDbBytes, mergeResult.manifest);
    navigate('/explorer');
  };

  const handleCloudSaveMerged = async () => {
    if (!mergeResult) return;
    try {
      await updateActiveDatabase(mergeResult.mergedDbBytes, mergeResult.manifest);
      await backupCurrentLibrary(outputName);
      setCloudSaveSuccess(true);
    } catch (err) {
      alert('Cloud save error: ' + (err as Error).message);
    }
  };

  const bothFilesLoaded = !!(primaryFile && secondaryFile);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* ── SECTION 1: HERO HEADER & TRUST BADGE ───────────────────────── */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        {/* Trust Anchor */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold backdrop-blur-md shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>100% Client-Side. Your data never leaves your computer.</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          Merge your{' '}
          <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 dark:from-blue-400 dark:via-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">
            .jwlibrary files
          </span>{' '}
          instantly.
        </h1>

        {/* Subheadline */}
        <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
          Combine your notes, highlights, and bookmarks from multiple devices seamlessly.
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleLoadDemoFiles}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] text-xs font-medium transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>Load Demo Pair (Tablet & Phone)</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 dark:border-red-900/60 rounded-xl text-xs sm:text-sm text-red-600 dark:text-red-300 text-center">
          {errorMessage}
        </div>
      )}

      {/* ── SECTION 2: INTERACTIVE BENTO GRID DROPZONE ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
        {/* LEFT CARD (SOURCE A / PRIMARY) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/80 p-6 space-y-4 backdrop-blur-xl transition-all hover:border-blue-500/30 dark:hover:border-white/[0.15] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Source A (Primary Base)</span>
            </div>
            {primaryFile ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Loaded</span>
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Required</span>
            )}
          </div>

          <input
            ref={primaryInputRef}
            type="file"
            accept=".jwlibrary"
            className="hidden"
            onChange={handlePrimaryUpload}
          />

          {!primaryFile ? (
            <div
              onClick={() => primaryInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-white/[0.1] hover:border-blue-500/50 rounded-xl p-8 text-center cursor-pointer transition-all space-y-2 bg-slate-50/50 hover:bg-slate-100/50 dark:bg-white/[0.01] dark:hover:bg-white/[0.03] group"
            >
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] group-hover:border-blue-500/30 flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Drop .jwlibrary here or browse</div>
              <div className="text-xs text-slate-500">e.g. Phone backup or baseline library</div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[190px]">
                      {primaryFile.summary.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {primaryFile.summary.deviceName} • {(primaryFile.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => primaryInputRef.current?.click()}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-200 dark:border-white/[0.06] text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 text-center">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{primaryFile.summary.notesCount}</span>
                  Notes
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{primaryFile.summary.userMarksCount}</span>
                  Highlights
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{primaryFile.summary.tagsCount}</span>
                  Tags
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{primaryFile.summary.bookmarksCount}</span>
                  Bookmarks
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{primaryFile.summary.playlistsCount}</span>
                  Playlists
                </div>
              </div>
            </div>
          )}

          {/* Cloud Picker Option for Source A */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => handlePickFromCloud('primary')}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-2 transition-all hover:border-blue-500/30"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isConnected ? 'Choose from Google Drive' : 'Connect Google Drive'}</span>
            </button>
          </div>
        </div>

        {/* CENTER CARD (THE CONNECTOR) */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 lg:py-0">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border ${
              bothFilesLoaded
                ? 'bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/25 scale-110'
                : 'bg-slate-100 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-400 dark:text-slate-600'
            }`}
          >
            <GitMerge className={`w-6 h-6 ${bothFilesLoaded ? 'animate-pulse' : ''}`} />
          </div>
        </div>

        {/* RIGHT CARD (SOURCE B / SECONDARY) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/80 p-6 space-y-4 backdrop-blur-xl transition-all hover:border-sky-500/30 dark:hover:border-white/[0.15] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <Tablet className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Source B (Second Device)</span>
            </div>
            {secondaryFile ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Loaded</span>
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Required</span>
            )}
          </div>

          <input
            ref={secondaryInputRef}
            type="file"
            accept=".jwlibrary"
            className="hidden"
            onChange={handleSecondaryUpload}
          />

          {!secondaryFile ? (
            <div
              onClick={() => secondaryInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-white/[0.1] hover:border-sky-500/50 rounded-xl p-8 text-center cursor-pointer transition-all space-y-2 bg-slate-50/50 hover:bg-slate-100/50 dark:bg-white/[0.01] dark:hover:bg-white/[0.03] group"
            >
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] group-hover:border-sky-500/30 flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Drop .jwlibrary here or browse</div>
              <div className="text-xs text-slate-500">e.g. Tablet backup or newer study file</div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[190px]">
                      {secondaryFile.summary.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {secondaryFile.summary.deviceName} • {(secondaryFile.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => secondaryInputRef.current?.click()}
                  className="text-xs text-sky-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-200 dark:border-white/[0.06] text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 text-center">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{secondaryFile.summary.notesCount}</span>
                  Notes
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{secondaryFile.summary.userMarksCount}</span>
                  Highlights
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{secondaryFile.summary.tagsCount}</span>
                  Tags
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{secondaryFile.summary.bookmarksCount}</span>
                  Bookmarks
                </div>
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-xs">{secondaryFile.summary.playlistsCount}</span>
                  Playlists
                </div>
              </div>
            </div>
          )}

          {/* Cloud Picker Option for Source B */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => handlePickFromCloud('secondary')}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-2 transition-all hover:border-sky-500/30"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-blue-400" />
              <span>{isConnected ? 'Choose from Google Drive' : 'Connect Google Drive'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: SUMMARY & CONFLICT RESOLUTION DASHBOARD ─────────── */}
      {bothFilesLoaded && !mergeResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Data Summary Bento Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-sm">
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {primaryFile.summary.notesCount + secondaryFile.summary.notesCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Total Notes Found</div>
            </div>
            <div className="bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-sm">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {primaryFile.summary.userMarksCount + secondaryFile.summary.userMarksCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Highlights to Combine</div>
            </div>
            <div className="bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-sm">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {primaryFile.summary.tagsCount + secondaryFile.summary.tagsCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Tags to Consolidate</div>
            </div>
            <div className="bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-sm">
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {primaryFile.summary.bookmarksCount + secondaryFile.summary.bookmarksCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Bookmarks</div>
            </div>
            <div className="bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl col-span-2 sm:col-span-1 shadow-sm">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {primaryFile.summary.playlistsCount + secondaryFile.summary.playlistsCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Playlists to Merge</div>
            </div>
          </div>

          {/* Conflict Resolution UI (Side-by-side comparison if identical verse collisions) */}
          {conflicts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/80 p-6 space-y-4 backdrop-blur-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Duplicate Verse Collisions ({conflicts.length} Found)</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select how to resolve notes on identical verses:
                </span>
              </div>

              <div className="space-y-3">
                {conflicts.map((conf, idx) => (
                  <div key={conf.id} className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 space-y-3 text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Collision #{idx + 1}: {conf.verseAnchor}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Source A Note */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                          conf.choice === 'a'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-300">Source A ({primaryFile.summary.deviceName})</span>
                          <input
                            type="radio"
                            name={`conf_${conf.id}`}
                            checked={conf.choice === 'a'}
                            onChange={() => {
                              setConflicts((prev) =>
                                prev.map((c) => (c.id === conf.id ? { ...c, choice: 'a' } : c))
                              );
                            }}
                            className="text-blue-500"
                          />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed line-clamp-3">
                          &ldquo;{conf.sourceAText}&rdquo;
                        </p>
                      </label>

                      {/* Source B Note */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                          conf.choice === 'b'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-300">Source B ({secondaryFile.summary.deviceName})</span>
                          <input
                            type="radio"
                            name={`conf_${conf.id}`}
                            checked={conf.choice === 'b'}
                            onChange={() => {
                              setConflicts((prev) =>
                                prev.map((c) => (c.id === conf.id ? { ...c, choice: 'b' } : c))
                              );
                            }}
                            className="text-blue-500"
                          />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed line-clamp-3">
                          &ldquo;{conf.sourceBText}&rdquo;
                        </p>
                      </label>
                    </div>

                    {/* Both Option */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConflicts((prev) =>
                            prev.map((c) => (c.id === conf.id ? { ...c, choice: 'both' } : c))
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                          conf.choice === 'both'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-white/[0.02]'
                        }`}
                      >
                        Combine Both Notes (Recommended)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merge Output Filename */}
          <div className="bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="w-full sm:w-auto">
              <label htmlFor="merged-filename-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Merged Archive Filename
              </label>
              <input
                id="merged-filename-input"
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-white/[0.12] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono w-full sm:w-80 shadow-sm"
              />
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Auto-checks integrity and signs SHA-256 manifest.
            </div>
          </div>
        </div>
      )}

      {/* ── PROGRESS BAR ───────────────────────────────────────────────── */}
      {isMerging && mergeProgress && (
        <div className="rounded-2xl border border-blue-500/40 bg-blue-50/70 dark:bg-blue-950/20 p-6 space-y-4 backdrop-blur-xl shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-900 dark:text-white">{mergeProgress.stage}</span>
            <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
              {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 dark:from-blue-500 dark:via-sky-400 dark:to-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
            />
          </div>

          {mergeProgress.details && (
            <div className="text-xs text-slate-600 dark:text-slate-400">{mergeProgress.details}</div>
          )}
        </div>
      )}

      {/* ── MERGE RESULT DASHBOARD ─────────────────────────────────────── */}
      {mergeResult && (
        <div className="rounded-3xl border border-emerald-500/40 bg-white dark:bg-[#0e1422]/90 p-6 sm:p-8 space-y-6 backdrop-blur-xl shadow-lg animate-in zoom-in-95 duration-200">
          <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Merge Completed Successfully!</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 py-2">
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">+{mergeResult.stats.notesAdded}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">New Notes Added</div>
            </div>
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{mergeResult.stats.notesMerged}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Duplicates Unified</div>
            </div>
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400">+{mergeResult.stats.marksAdded}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Highlights Added</div>
            </div>
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">+{mergeResult.stats.bookmarksAdded}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Bookmarks Added</div>
            </div>
            <div className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 col-span-2 sm:col-span-1 shadow-sm">
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">+{mergeResult.stats.tagsAdded}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Tags Consolidated</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30"
            >
              <Download className="w-4 h-4" />
              <span>Download Combined Backup</span>
            </button>

            <button
              type="button"
              onClick={handleCloudSaveMerged}
              disabled={isUploading || cloudSaveSuccess}
              className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                cloudSaveSuccess
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200'
              }`}
            >
              <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{cloudSaveSuccess ? 'Saved to Google Drive ✓' : isUploading ? 'Uploading...' : 'Save to Google Drive'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInExplorer}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] font-medium text-sm transition-all"
            >
              <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Explore in App</span>
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION 4: FLOATING ACTION CTA ─────────────────────────────── */}
      {bothFilesLoaded && !mergeResult && (
        <div className="sticky bottom-6 z-30 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300 px-4">
          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={isMerging}
            className="w-full sm:w-auto px-4 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-base tracking-wide transition-all shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center space-x-2 sm:space-x-3 border border-blue-400/30 backdrop-blur-md"
          >
            <GitMerge className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Merge & Download Backup</span>
              <span className="hidden sm:inline">Generate & Download Combined Backup</span>
            </span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 flex-shrink-0" />
          </button>
        </div>
      )}

      {/* ── CLOUD PICKER MODAL (WHEN SELECTING FILE FOR SOURCE A OR B) ─── */}
      {cloudPickerTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e1422] border border-slate-200 dark:border-white/[0.12] rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white">
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>
                  Select Backup for {cloudPickerTarget === 'primary' ? 'Source A' : 'Source B'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCloudPickerTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isDownloadingCloud ? (
              <div className="py-10 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Downloading backup from Google Drive...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>No backups found in your Google Drive &ldquo;JW Sync&rdquo; folder.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleSelectCloudBackup(b)}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-white/[0.02] dark:hover:bg-blue-500/10 border border-slate-200 dark:border-white/[0.06] hover:border-blue-500/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="truncate max-w-[80%]">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{b.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {b.createdTime ? new Date(b.createdTime).toLocaleDateString() : 'Recent'} •{' '}
                        {b.size ? `${(parseInt(b.size, 10) / 1024).toFixed(1)} KB` : ''}
                      </div>
                    </div>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">Select →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
