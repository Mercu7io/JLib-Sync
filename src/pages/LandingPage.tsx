import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  HelpCircle,
} from 'lucide-react';
import { extractJwLibrary } from '../lib/jw/zip';
import { openDatabase, getLibrarySummary, queryAll } from '../lib/jw/sqlite';
import { mergeJwLibraries, IMergeResult } from '../lib/jw/merge';
import { IManifest, ILibrarySummary, IMergeProgress, TagManagerMap } from '../lib/jw/types';
import { useAppStore } from '../store/useAppStore';
import { useCloudStore } from '../store/useCloudStore';
import { IDriveFile } from '../lib/cloud/googleDrive';
import { useTranslation } from 'react-i18next';

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

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
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
      } catch (e) {
        console.warn('Conflict detection non-critical error:', e);
      }
    })();
  }, [primaryFile, secondaryFile]);

  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadPrimary(file);
    } catch (err) {
      setErrorMessage('Failed to read primary file: ' + (err as Error).message);
    }
  };

  const handleSecondaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadSecondary(file);
    } catch (err) {
      setErrorMessage('Failed to read secondary file: ' + (err as Error).message);
    }
  };

  const handleLoadDemoFiles = async () => {
    try {
      setErrorMessage(null);
      const res1 = await fetch('/example.jwlibrary');
      const blob1 = await res1.blob();
      const f1 = new File([blob1], 'Phone_Study.jwlibrary', { type: 'application/zip' });
      await loadPrimary(f1);

      const res2 = await fetch('/example2.jwlibrary');
      const blob2 = await res2.blob();
      const f2 = new File([blob2], 'Tablet_Study.jwlibrary', { type: 'application/zip' });
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
    <div className="relative overflow-hidden pb-12 space-y-8">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-b from-indigo-600/15 via-blue-600/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* ── HEADER HERO ────────────────────────────────────────────── */}
      <section className="pt-6 sm:pt-10 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-semibold backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>{t('landing.privacyBadge', '100% Client-Side SQLite WASM • Zero Upload')}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {t('merge.heroTitle', 'Universal Multi-Device Merge')}
        </h1>

        <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
          {t('merge.heroSubtitle', 'Combine your phone and tablet backups seamlessly into one unified archive.')}
        </p>
      </section>

      {/* Error alert */}
      {errorMessage && (
        <div className="max-w-3xl mx-auto px-4">
          <div className="p-3.5 bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 rounded-2xl text-xs text-red-600 dark:text-red-300 text-center">
            {errorMessage}
          </div>
        </div>
      )}

      {/* ── CARDS: UNIVERSAL PHONE & TABLET DROPZONES ──────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
          
          {/* LEFT CARD: UNIVERSAL PHONE */}
          <div className="md:col-span-5 rounded-3xl border border-slate-200/90 dark:border-white/[0.08] bg-white/90 dark:bg-[#101625]/85 p-6 space-y-4 backdrop-blur-xl shadow-lg shadow-slate-900/5 dark:shadow-black/40 transition-all hover:border-blue-500/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Phone</span>
              </div>
              {primaryFile ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>{t('common.loaded', 'Loaded')}</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">{t('common.required', 'Required')}</span>
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
                className="group border-2 border-dashed border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-2xl p-7 text-center cursor-pointer transition-all space-y-3 bg-slate-50/60 hover:bg-blue-50/20 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]"
              >
                {/* Universal Phone outline icon with centered punch-hole */}
                <div className="w-12 h-16 rounded-xl border-2 border-slate-400 group-hover:border-blue-500 dark:border-slate-500 dark:group-hover:border-blue-400 flex flex-col items-center justify-between p-1 mx-auto transition-colors shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 dark:bg-slate-500 dark:group-hover:bg-blue-400 mt-0.5" />
                  <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400" />
                  <div className="w-4 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600 mb-0.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t('merge.dropHere', 'Drop .jwlibrary or browse')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Phone study backup</div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px]">
                      {primaryFile.summary.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {primaryFile.summary.deviceName} • {(primaryFile.file.size / 1024).toFixed(1)} KB
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
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{primaryFile.summary.notesCount}</span> notes
                  <span>•</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{primaryFile.summary.userMarksCount}</span> highlights
                  <span>•</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{primaryFile.summary.tagsCount}</span> tags
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => handlePickFromCloud('primary')}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isConnected ? t('merge.chooseFromDrive', 'Choose from Google Drive') : t('nav.connectDrive', 'Pick from Google Drive')}</span>
            </button>
          </div>

          {/* CONNECTOR CIRCLE */}
          <div className="md:col-span-1 flex flex-col items-center justify-center py-2 md:py-0">
            <div
              className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-300 border ${
                bothFilesLoaded
                  ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/40 scale-110'
                  : 'bg-slate-100/90 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-400'
              }`}
            >
              <GitMerge className={`w-5 h-5 ${bothFilesLoaded ? 'animate-pulse' : ''}`} />
            </div>
          </div>

          {/* RIGHT CARD: UNIVERSAL TABLET */}
          <div className="md:col-span-5 rounded-3xl border border-slate-200/90 dark:border-white/[0.08] bg-white/90 dark:bg-[#101625]/85 p-6 space-y-4 backdrop-blur-xl shadow-lg shadow-slate-900/5 dark:shadow-black/40 transition-all hover:border-sky-500/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Tablet className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Tablet</span>
              </div>
              {secondaryFile ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>{t('common.loaded', 'Loaded')}</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">{t('common.required', 'Required')}</span>
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
                className="group border-2 border-dashed border-slate-200 dark:border-white/[0.08] hover:border-sky-500/50 rounded-2xl p-7 text-center cursor-pointer transition-all space-y-3 bg-slate-50/60 hover:bg-sky-50/20 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]"
              >
                {/* Universal Tablet outline icon with centered camera */}
                <div className="w-16 h-16 rounded-xl border-2 border-slate-400 group-hover:border-sky-500 dark:border-slate-500 dark:group-hover:border-sky-400 flex flex-col items-center justify-between p-1 mx-auto transition-colors shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-sky-500 dark:bg-slate-500 dark:group-hover:bg-sky-400 mt-0.5" />
                  <Upload className="w-4 h-4 text-slate-400 group-hover:text-sky-500 dark:text-slate-500 dark:group-hover:text-sky-400" />
                  <div className="w-6 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600 mb-0.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {t('merge.dropHere', 'Drop .jwlibrary or browse')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Tablet study backup</div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px]">
                      {secondaryFile.summary.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {secondaryFile.summary.deviceName} • {(secondaryFile.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => secondaryInputRef.current?.click()}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                  >
                    Change
                  </button>
                </div>
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{secondaryFile.summary.notesCount}</span> notes
                  <span>•</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{secondaryFile.summary.userMarksCount}</span> highlights
                  <span>•</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{secondaryFile.summary.tagsCount}</span> tags
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => handlePickFromCloud('secondary')}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>{isConnected ? t('merge.chooseFromDrive', 'Choose from Google Drive') : t('nav.connectDrive', 'Pick from Google Drive')}</span>
            </button>
          </div>

        </div>
      </section>

      {/* ── CONFLICT RESOLUTION IF ANY ─────────────────────────────── */}
      {bothFilesLoaded && !mergeResult && conflicts.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-5 sm:p-6 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Verse Collisions Detected ({conflicts.length})</span>
              </div>
              <span className="text-[11px] text-slate-500">Choose how to resolve:</span>
            </div>

            <div className="space-y-3">
              {conflicts.map((conf, idx) => (
                <div key={conf.id} className="p-3.5 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl space-y-2.5 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Collision #{idx + 1}: {conf.verseAnchor}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className={`p-3 rounded-xl border cursor-pointer transition-all ${conf.choice === 'a' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-200 dark:border-white/[0.06]'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">Phone ({primaryFile.summary.deviceName})</span>
                        <input type="radio" name={`conf_${conf.id}`} checked={conf.choice === 'a'} onChange={() => setConflicts(prev => prev.map(c => c.id === conf.id ? { ...c, choice: 'a' } : c))} />
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">&ldquo;{conf.sourceAText}&rdquo;</p>
                    </label>
                    <label className={`p-3 rounded-xl border cursor-pointer transition-all ${conf.choice === 'b' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-200 dark:border-white/[0.06]'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">Tablet ({secondaryFile.summary.deviceName})</span>
                        <input type="radio" name={`conf_${conf.id}`} checked={conf.choice === 'b'} onChange={() => setConflicts(prev => prev.map(c => c.id === conf.id ? { ...c, choice: 'b' } : c))} />
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">&ldquo;{conf.sourceBText}&rdquo;</p>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConflicts(prev => prev.map(c => c.id === conf.id ? { ...c, choice: 'both' } : c))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${conf.choice === 'both' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    {t('merge.combineBoth', 'Combine Both Notes')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ACTION BUTTON: GLOWING "MERGE" ─────────────────────────── */}
      {bothFilesLoaded && !mergeResult && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-4 sm:p-5 rounded-3xl bg-white/90 dark:bg-[#101625]/90 border border-slate-200/90 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-xl">
            <div className="w-full sm:w-auto space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('merge.outputFilename', 'Combined Backup Archive Name')}
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono w-full sm:w-80 shadow-sm"
              />
            </div>

            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={isMerging}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center space-x-2"
            >
              <GitMerge className="w-4 h-4" />
              <span>{isMerging ? 'Merging...' : 'Merge Backups'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </section>
      )}

      {/* ── MERGE PROGRESS ─────────────────────────────────────────── */}
      {isMerging && mergeProgress && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-blue-500/40 bg-blue-50/70 dark:bg-blue-950/20 p-5 space-y-3 backdrop-blur-xl shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
              <span>{mergeProgress.stage}</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── MERGE SUCCESS RESULT ───────────────────────────────────── */}
      {mergeResult && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 animate-in zoom-in-95 duration-200">
          <div className="rounded-3xl border border-emerald-500/35 bg-white/95 dark:bg-[#101625]/95 p-6 sm:p-8 space-y-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {t('merge.successTitle', 'Merge Completed Successfully!')}
              </h2>
            </div>

            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex flex-wrap gap-x-5 gap-y-1.5 font-semibold">
              <span>+{mergeResult.stats.notesAdded} new notes</span>
              <span>•</span>
              <span>{mergeResult.stats.notesMerged} duplicates unified</span>
              <span>•</span>
              <span>+{mergeResult.stats.marksAdded} highlights combined</span>
              <span>•</span>
              <span>+{mergeResult.stats.tagsAdded} tags consolidated</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30"
              >
                <Download className="w-4 h-4" />
                <span>{t('merge.downloadCombined', 'Download Combined Backup')}</span>
              </button>

              <button
                type="button"
                onClick={handleCloudSaveMerged}
                disabled={isUploading || cloudSaveSuccess}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-all"
              >
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{cloudSaveSuccess ? t('merge.savedDrive') : isUploading ? t('merge.savingDrive') : t('merge.saveDrive')}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenInExplorer}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-all"
              >
                <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{t('merge.exploreInApp', 'Explore in App')}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── DEMO PAIR & HELP LINKS (BELOW DROPZONES, JUST ABOVE FOOTER) ── */}
      <section className="text-center pt-2 pb-6">
        <div className="inline-flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] px-4 py-2 rounded-2xl backdrop-blur-md shadow-sm">
          <button
            type="button"
            onClick={handleLoadDemoFiles}
            className="inline-flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('merge.loadDemoPair', 'Load Demo Pair (Tablet & Phone)')}</span>
          </button>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <Link
            to="/help"
            className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>How to export?</span>
          </Link>
        </div>
      </section>

      {/* ── GOOGLE DRIVE CLOUD PICKER MODAL ────────────────────────── */}
      {cloudPickerTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-white/[0.1] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white">
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>
                  Select Backup for {cloudPickerTarget === 'primary' ? 'Phone' : 'Tablet'}
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
                <p>No backups found in your Google Drive “JW Sync” folder.</p>
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
