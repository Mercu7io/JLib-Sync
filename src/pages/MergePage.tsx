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
  Tag,
} from 'lucide-react';
import { extractJwLibrary } from '../lib/jw/zip';
import { openDatabase, getLibrarySummary, queryAll } from '../lib/jw/sqlite';
import { mergeJwLibraries, IMergeResult } from '../lib/jw/merge';
import { IManifest, ILibrarySummary, IMergeProgress, TagManagerMap } from '../lib/jw/types';
import { detectRealConflicts, IConflictItem } from '../lib/jw/conflicts';
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

export const MergePage: React.FC = () => {
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

  // Tag imported notes option
  const [tagImportedNotes, setTagImportedNotes] = useState<boolean>(false);
  const [customImportTagName, setCustomImportTagName] = useState<string>('From Merge');

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

        const detected = detectRealConflicts(dbA, dbB);

        dbA.close();
        dbB.close();

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

      const conflictResolutions: Record<string, 'both' | 'a' | 'b'> = {};
      conflicts.forEach((c) => {
        conflictResolutions[c.id] = c.choice;
      });

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
          conflictResolutions,
          secondaryNoteTag: tagImportedNotes ? (customImportTagName.trim() || 'From Merge') : undefined,
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t('merge.heroTitle', 'Multi-Device Backup Merge')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {t('merge.heroSubtitle', 'Combine phone and tablet backups into a single unified archive with automated deduplication.')}
        </p>
        <div className="pt-1">
          <button
            type="button"
            onClick={handleLoadDemoFiles}
            className="inline-flex items-center space-x-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('merge.loadDemoPair', 'Try with demo files')}</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3.5 bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-300 text-center">
          {errorMessage}
        </div>
      )}

      {/* ── DROPZONES (SOURCE A & SOURCE B) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SOURCE A */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t('merge.sourceA', 'Source A (Phone)')}</span>
            </div>
            {primaryFile ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>{t('common.loaded', 'Loaded')}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">{t('common.required', 'Required')}</span>
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
              className="border-2 border-dashed border-slate-200 dark:border-white/[0.1] hover:border-blue-500/50 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2 bg-slate-50/50 hover:bg-blue-50/20 dark:bg-white/[0.01] group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{t('merge.dropHere', 'Select .jwlibrary')}</div>
              <p className="text-[11px] text-slate-500">Drop file here or click to browse</p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px]">
                    {primaryFile.summary.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
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
              <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 flex-wrap">
                <span>{primaryFile.summary.notesCount} notes</span>
                <span>•</span>
                <span>{primaryFile.summary.userMarksCount} highlights</span>
                <span>•</span>
                <span>{primaryFile.summary.tagsCount} tags</span>
                <span>•</span>
                <span>{primaryFile.summary.playlistsCount} playlists</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => handlePickFromCloud('primary')}
            className="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isConnected ? t('merge.chooseFromDrive', 'Choose from Google Drive') : t('nav.connectDrive', 'Pick from Google Drive')}</span>
          </button>
        </div>

        {/* SOURCE B */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Tablet className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{t('merge.sourceB', 'Source B (Tablet)')}</span>
            </div>
            {secondaryFile ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>{t('common.loaded', 'Loaded')}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">{t('common.required', 'Required')}</span>
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
              className="border-2 border-dashed border-slate-200 dark:border-white/[0.1] hover:border-sky-500/50 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2 bg-slate-50/50 hover:bg-sky-50/20 dark:bg-white/[0.01] group"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{t('merge.dropHere', 'Select .jwlibrary')}</div>
              <p className="text-[11px] text-slate-500">Drop file here or click to browse</p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[200px]">
                    {secondaryFile.summary.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {secondaryFile.summary.deviceName} • {(secondaryFile.file.size / 1024).toFixed(1)} KB
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
              <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/[0.04] text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-1.5 flex-wrap">
                <span>{secondaryFile.summary.notesCount} notes</span>
                <span>•</span>
                <span>{secondaryFile.summary.userMarksCount} highlights</span>
                <span>•</span>
                <span>{secondaryFile.summary.tagsCount} tags</span>
                <span>•</span>
                <span>{secondaryFile.summary.playlistsCount} playlists</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => handlePickFromCloud('secondary')}
            className="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
          >
            <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-blue-400" />
            <span>{isConnected ? t('merge.chooseFromDrive', 'Choose from Google Drive') : t('nav.connectDrive', 'Pick from Google Drive')}</span>
          </button>
        </div>
      </div>

      {/* ── CONFLICT RESOLUTION (IF ANY) ───────────────────────────────── */}
      {bothFilesLoaded && !mergeResult && conflicts.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
              <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Duplicate Verse Conflicts ({conflicts.length})</span>
            </div>
            <span className="text-[11px] text-slate-500">Choose which notes to keep:</span>
          </div>

          <div className="space-y-2.5">
            {conflicts.map((conf, idx) => (
              <div key={conf.id} className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  #{idx + 1}: {conf.verseAnchor}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`p-2.5 rounded-lg border cursor-pointer ${conf.choice === 'a' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-200 dark:border-white/[0.06]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px]">Source A</span>
                      <input type="radio" name={`conf_${conf.id}`} checked={conf.choice === 'a'} onChange={() => setConflicts(prev => prev.map(c => c.id === conf.id ? { ...c, choice: 'a' } : c))} />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">&ldquo;{conf.sourceAText}&rdquo;</p>
                  </label>
                  <label className={`p-2.5 rounded-lg border cursor-pointer ${conf.choice === 'b' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-200 dark:border-white/[0.06]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px]">Source B</span>
                      <input type="radio" name={`conf_${conf.id}`} checked={conf.choice === 'b'} onChange={() => setConflicts(prev => prev.map(c => c.id === conf.id ? { ...c, choice: 'b' } : c))} />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">&ldquo;{conf.sourceBText}&rdquo;</p>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setConflicts(prev => prev.map(c => c.id === conf.id ? { ...c, choice: 'both' } : c))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${conf.choice === 'both' ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {t('merge.combineBoth', 'Keep Both Notes')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SMART TAGGING FOR IMPORTED NOTES ───────────────────────── */}
      {bothFilesLoaded && !mergeResult && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-4 sm:p-5 space-y-3.5 shadow-sm transition-all">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mt-0.5">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('merge.tagImportedNotes', 'Tag notes imported from Backup 2')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('merge.tagImportedNotesDesc', 'Attach a tag to all notes imported from the second backup so you can easily review them under Personal Study > Tags in JW Library.')}
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={tagImportedNotes}
                onChange={(e) => setTagImportedNotes(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {tagImportedNotes && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex flex-wrap items-center gap-2.5 animate-in fade-in-50 duration-200">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('merge.tagImportedNotesLabel', 'Tag name')}:
              </span>
              <input
                type="text"
                value={customImportTagName}
                onChange={(e) => setCustomImportTagName(e.target.value)}
                placeholder={t('merge.fromMerge', 'From Merge')}
                className="text-xs bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-white/[0.1] rounded-xl px-3.5 py-2 text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500 outline-none w-48 shadow-sm"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCustomImportTagName(t('merge.fromMerge', 'From Merge'))}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('merge.fromMerge', 'From Merge')}
                </button>
                {secondaryFile?.summary?.deviceName && (
                  <button
                    type="button"
                    onClick={() => setCustomImportTagName(t('merge.fromDevice', { device: secondaryFile.summary.deviceName, defaultValue: `From ${secondaryFile.summary.deviceName}` }))}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 transition-colors truncate max-w-[180px]"
                  >
                    {t('merge.fromDevice', { device: secondaryFile.summary.deviceName, defaultValue: `From ${secondaryFile.summary.deviceName}` })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCustomImportTagName(t('merge.backup2', 'Backup 2'))}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t('merge.backup2', 'Backup 2')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OUTPUT FILENAME & MERGE BUTTON ─────────────────────────────── */}
      {bothFilesLoaded && !mergeResult && (
        <div className="p-4 rounded-2xl bg-white dark:bg-[#101625] border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="w-full sm:w-auto space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {t('merge.outputFilename', 'Combined Backup Name')}
            </label>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono w-full sm:w-72"
            />
          </div>

          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={isMerging}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-lg shadow-blue-600/30 inline-flex items-center justify-center space-x-2"
          >
            <GitMerge className="w-4 h-4" />
            <span>{isMerging ? t('merge.merging', 'Merging...') : t('merge.buttonMerge', 'Generate & Download Combined Backup')}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {/* ── PROGRESS BAR ───────────────────────────────────────────────── */}
      {isMerging && mergeProgress && (
        <div className="rounded-2xl border border-blue-500/40 bg-blue-50/70 dark:bg-blue-950/20 p-5 space-y-3 backdrop-blur-xl shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
            <span>{mergeProgress.stage}</span>
            <span className="text-blue-600 dark:text-blue-400 font-mono">
              {Math.round((mergeProgress.current / mergeProgress.total) * 100)}%
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(mergeProgress.current / mergeProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── SUCCESS RESULT ─────────────────────────────────────────────── */}
      {mergeResult && (
        <div className="rounded-2xl border border-emerald-500/30 bg-white dark:bg-[#101625] p-6 space-y-5 shadow-lg animate-in zoom-in-95 duration-150">
          <div className="flex items-center space-x-2.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('merge.successTitle', 'Merge Completed Successfully!')}</h2>
          </div>

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex flex-wrap gap-x-4 gap-y-1 font-medium">
            <span>{t('merge.statNewNotes', { count: mergeResult.stats.notesAdded, defaultValue: `+${mergeResult.stats.notesAdded} new notes` })}</span>
            <span>•</span>
            <span>{t('merge.statDuplicatesUnified', { count: mergeResult.stats.notesMerged, defaultValue: `${mergeResult.stats.notesMerged} duplicates unified` })}</span>
            <span>•</span>
            <span>{t('merge.statHighlightsCombined', { count: mergeResult.stats.marksAdded, defaultValue: `+${mergeResult.stats.marksAdded} highlights combined` })}</span>
            <span>•</span>
            <span>{t('merge.statTagsConsolidated', { count: mergeResult.stats.tagsAdded, defaultValue: `+${mergeResult.stats.tagsAdded} tags consolidated` })}</span>
            {mergeResult.stats.bookmarksAdded > 0 && (
              <>
                <span>•</span>
                <span>{t('merge.statBookmarksAdded', { count: mergeResult.stats.bookmarksAdded, defaultValue: `+${mergeResult.stats.bookmarksAdded} bookmarks added` })}</span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/25"
            >
              <Download className="w-4 h-4" />
              <span>{t('merge.downloadCombined', 'Download Combined Backup')}</span>
            </button>

            <button
              type="button"
              onClick={handleCloudSaveMerged}
              disabled={isUploading || cloudSaveSuccess}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-all"
            >
              <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{cloudSaveSuccess ? t('merge.savedDrive') : isUploading ? t('merge.savingDrive') : t('merge.saveDrive')}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInExplorer}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-all"
            >
              <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t('merge.exploreInApp', 'Explore in App')}</span>
            </button>
          </div>
        </div>
      )}


      {/* ── GOOGLE DRIVE CLOUD FILE PICKER MODAL ───────────────────────── */}
      {cloudPickerTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-white/[0.1] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white">
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>
                  {t('merge.selectBackupFor')} {cloudPickerTarget === 'primary' ? 'Source A' : 'Source B'}
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
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{t('merge.downloadingCloud')}</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>{t('merge.noCloudBackups')}</p>
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
