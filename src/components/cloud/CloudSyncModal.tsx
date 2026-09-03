import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud,
  X,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  Lock,
  Unlock,
  Key,
  Search,
  ArrowUpDown,
  GitMerge,
  CheckSquare,
  Square,
  Settings,
} from 'lucide-react';
import { useCloudStore } from '../../store/useCloudStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

export const CloudSyncModal: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    isConnected,
    backups,
    isLoading,
    isUploading,
    statusMessage,
    error,
    connect,
    disconnect,
    refreshBackups,
    backupCurrentLibrary,
    restoreCloudBackup,
    deleteCloudBackup,
    batchDeleteBackups,
    downloadCloudFile,
    setShowCloudModal,
    clearError,
    encryptionEnabled,
    encryptionPassword,
    setEncryptionConfig,
  } = useCloudStore();

  const { activeLibraryBytes, summary } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customBackupName, setCustomBackupName] = useState('');

  // Encryption Settings UI
  const [showSettings, setShowSettings] = useState(false);
  const [encToggle, setEncToggle] = useState(encryptionEnabled);
  const [encPass, setEncPass] = useState(encryptionPassword || '');
  const [encDuration, setEncDuration] = useState<number>(0);

  // Decryption Prompt UI
  const [promptFileId, setPromptFileId] = useState<string | null>(null);
  const [promptFileName, setPromptFileName] = useState<string | null>(null);
  const [promptAction, setPromptAction] = useState<'load' | 'merge'>('load');
  const [decryptPass, setDecryptPass] = useState('');
  const [decryptError, setDecryptError] = useState('');

  useEffect(() => {
    setEncToggle(encryptionEnabled);
    setEncPass(encryptionPassword || '');
  }, [encryptionEnabled, encryptionPassword]);

  // Filter and sort backups
  const filteredBackups = useMemo(() => {
    let list = backups.filter((b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    list = [...list].sort((a, b) => {
      const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [backups, searchQuery, sortOrder]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredBackups.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBackups.map((b) => b.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to permanently delete ${selectedIds.length} backup(s) from Google Drive?`
      )
    ) {
      await batchDeleteBackups(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleMergeSelected = async () => {
    if (selectedIds.length !== 2) return;
    const file1Meta = backups.find((b) => b.id === selectedIds[0]);
    const file2Meta = backups.find((b) => b.id === selectedIds[1]);
    if (!file1Meta || !file2Meta) return;

    try {
      setShowCloudModal(false);
      const [f1, f2] = await Promise.all([
        downloadCloudFile(file1Meta.id, file1Meta.name),
        downloadCloudFile(file2Meta.id, file2Meta.name),
      ]);

      (window as any).__PANDA_PRELOAD_MERGE__ = {
        primary: f1,
        secondary: f2,
      };

      navigate('/merge');
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED' || err.message.includes('Decryption failed')) {
        setShowCloudModal(true);
        setPromptAction('merge');
        setPromptFileId(selectedIds[0]); // Hacky, ideally we ask for both if needed
        setDecryptError('Decryption required for merge.');
      } else {
        alert('Error downloading cloud files for merge: ' + err.message);
      }
    }
  };

  const handleUploadClick = async () => {
    try {
      if (encToggle && !encPass) {
        setShowSettings(true);
        alert('Please enter an encryption password in the settings first.');
        return;
      }
      await backupCurrentLibrary(customBackupName.trim() || undefined);
      setCustomBackupName('');
    } catch (_) {}
  };

  const handleSaveSettings = () => {
    setEncryptionConfig(encToggle, encToggle ? encPass : null, encToggle ? encDuration : 0);
    setShowSettings(false);
  };

  const handleRestoreClick = async (b: any) => {
    try {
      await restoreCloudBackup(b.id, b.name);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED' || err.message.includes('Decryption failed')) {
        setPromptFileId(b.id);
        setPromptFileName(b.name);
        setPromptAction('load');
        setDecryptError(err.message === 'PASSWORD_REQUIRED' ? '' : 'Incorrect password.');
      }
    }
  };

  const handleDecryptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptFileId || !promptFileName) return;
    
    // Temporarily set password in store for this operation
    setEncryptionConfig(true, decryptPass, 0); // Temporary session config
    setDecryptError('');

    try {
      if (promptAction === 'load') {
        await restoreCloudBackup(promptFileId, promptFileName);
        setPromptFileId(null);
        setDecryptPass('');
      } else {
        // Retry merge
        await handleMergeSelected();
        setPromptFileId(null);
        setDecryptPass('');
      }
    } catch (err: any) {
      setDecryptError('Decryption failed. Incorrect password?');
      setEncryptionConfig(encryptionEnabled, encryptionPassword, 0); // Revert
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0e1422] border border-slate-200 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-2xl max-w-2xl w-full p-4 sm:p-7 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        {/* Decryption Overlay */}
        {promptFileId && (
          <div className="absolute inset-0 z-50 bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4 sm:p-6">
            <form onSubmit={handleDecryptSubmit} className="w-full max-w-sm space-y-4 bg-slate-50 dark:bg-white/[0.03] p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-2xl">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 mx-auto flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Encrypted File</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Enter password to decrypt {promptFileName}</p>
              </div>
              
              <div className="space-y-1">
                <input
                  type="password"
                  value={decryptPass}
                  onChange={e => setDecryptPass(e.target.value)}
                  placeholder="Encryption Password"
                  className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-white/[0.1] rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                {decryptError && <p className="text-[11px] text-red-500 mt-1">{decryptError}</p>}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPromptFileId(null);
                    setDecryptError('');
                    setDecryptPass('');
                  }}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!decryptPass}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md"
                >
                  Decrypt & Load
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
                <span>{t('cloud.title')}</span>
                {isConnected && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{t('cloud.connected')}</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage, search, batch delete, and select backups from your Google Drive <code className="text-blue-600 dark:text-blue-400 font-semibold">JW Sync</code> folder.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isConnected && (
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'}`}
                title="Encryption Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCloudModal(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Error alerts */}
        {error && (
          <div className="p-3.5 bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 dark:border-red-900/60 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/40 rounded-xl text-xs text-blue-600 dark:text-blue-300 flex items-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ── NOT CONNECTED VIEW ────────────────────────────────────────── */}
        {!isConnected ? (
          <div className="space-y-6 text-center py-6">
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Connect Your Google Drive</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Seamlessly store your merged libraries in your personal Google Drive and pull backups to any device without cables.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={connect}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/25"
              >
                <Cloud className="w-4 h-4" />
                <span>{t('cloud.connectButton')}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] text-left text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-300 font-semibold">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Zero-Access Guarantee</span>
              </div>
              <p className="leading-relaxed">
                Panda JWL-Sync uses Google’s strictly sandboxed <code className="text-slate-800 dark:text-slate-300 font-semibold">drive.file</code> scope. It can only see files it creates itself in your <code className="text-slate-800 dark:text-slate-300 font-semibold">JW Sync</code> folder.
              </p>
            </div>
          </div>
        ) : (
          /* ── CONNECTED VIEW ─────────────────────────────────────────── */
          <div className="space-y-5">

            {/* Encryption Settings Panel */}
            {showSettings && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.1] space-y-4 animate-in slide-in-from-top-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Client-Side Encryption</h3>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={encToggle} onChange={() => setEncToggle(!encToggle)} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${encToggle ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${encToggle ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                </div>

                {encToggle && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
                      <strong>Warning:</strong> If you lose your password, your encrypted backups cannot be recovered.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Encryption Password</label>
                        <input
                          type="password"
                          value={encPass}
                          onChange={e => setEncPass(e.target.value)}
                          placeholder="SuperSecretPassword"
                          className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Remember Password</label>
                        <select
                          value={encDuration}
                          onChange={e => setEncDuration(Number(e.target.value))}
                          className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-white/[0.1] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                        >
                          <option value={0}>Only this session (Don't save)</option>
                          <option value={86400000}>1 Day</option>
                          <option value={604800000}>1 Week</option>
                          <option value={2592000000}>1 Month</option>
                          <option value={31536000000}>1 Year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}

            {/* Backup Active Library Bar */}
            {activeLibraryBytes ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-emerald-500/5 to-transparent border border-blue-500/25 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5" title="Will be encrypted">
                      <span>Save Active Library to Cloud</span>
                      {encryptionEnabled && <Lock className="w-3 h-3 text-amber-500" />}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {summary?.name} • {summary?.notesCount} notes • {summary?.tagsCount} tags
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    {encryptionEnabled ? <Lock className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{isUploading ? 'Uploading...' : encryptionEnabled ? 'Encrypt & Upload' : 'Save to Drive'}</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Controls Bar: Search, Sort, Batch Actions */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cloud backups by name..."
                    className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-300 dark:border-white/[0.1] rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#0b0f17] border border-slate-300 dark:border-white/[0.1] rounded-xl px-2.5 py-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      aria-label="Sort backups"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                      className="bg-transparent text-slate-800 dark:text-slate-300 text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="newest" className="bg-white dark:bg-[#0e1422] text-slate-900 dark:text-slate-100">Newest First</option>
                      <option value="oldest" className="bg-white dark:bg-[#0e1422] text-slate-900 dark:text-slate-100">Oldest First</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={refreshBackups}
                    disabled={isLoading}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] transition-colors"
                    title="Refresh list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Batch Action Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1 pb-1">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium"
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredBackups.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    )}
                    <span>Select All ({filteredBackups.length})</span>
                  </button>

                  {selectedIds.length > 0 && (
                    <span className="text-slate-500">• {selectedIds.length} selected</span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {/* Merge 2 Selected Files */}
                  {selectedIds.length === 2 && (
                    <button
                      type="button"
                      onClick={handleMergeSelected}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Merge 2 Selected Files</span>
                    </button>
                  )}

                  {/* Batch Delete */}
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 text-xs font-semibold transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedIds.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={disconnect}
                    className="text-slate-500 hover:text-red-500 text-xs underline pl-2"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Backups List */}
              {filteredBackups.length === 0 ? (
                <div className="text-center py-10 border border-slate-200 dark:border-white/[0.06] rounded-xl bg-slate-50 dark:bg-white/[0.01] space-y-2">
                  <HardDrive className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No backups match your search query.' : 'No backups found in Google Drive yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredBackups.map((b) => {
                    const isSelected = selectedIds.includes(b.id);
                    const isEncrypted = b.name.endsWith('.enc');
                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between text-xs transition-colors gap-3 ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/40'
                            : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04] border-slate-200 dark:border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center space-x-3 truncate max-w-full sm:max-w-[65%]">
                          <button
                            type="button"
                            onClick={() => toggleSelect(b.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex-shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            )}
                          </button>

                          <div className="space-y-0.5 truncate flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center space-x-1.5" title={isEncrypted ? 'Encrypted' : undefined}>
                              {isEncrypted && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                              <span className="truncate">{b.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                              <span>
                                {b.createdTime ? new Date(b.createdTime).toLocaleString() : 'Recent'}
                              </span>
                              {b.size && (
                                <span>• {(parseInt(b.size, 10) / 1024).toFixed(1)} KB</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 flex-shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleRestoreClick(b)}
                            disabled={isLoading}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              isEncrypted 
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {isEncrypted ? <Unlock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                            <span>{isEncrypted ? 'Decrypt' : 'Load'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete "${b.name}" from Google Drive?`)) {
                                deleteCloudBackup(b.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete from cloud"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
