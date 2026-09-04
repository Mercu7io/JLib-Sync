import React, { useRef, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  X,
  Menu,
  Settings,
  Sun,
  Moon,
  Monitor,
  Download,
  Share2,
  HelpCircle,
  Cloud,
  FolderOpen,
  GitMerge,
  BookOpen,
  BarChart3,
  Type,
  Upload,
  WifiOff,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCloudStore } from '../../store/useCloudStore';
import { SUPPORTED_LANGUAGES } from '../../lib/jw/locales';
import { getThemePreference, setThemePreference, ThemeMode, getTextSizePreference, setTextSizePreference, TextSizeLevel } from '../../lib/theme';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useTranslation } from 'react-i18next';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const {
    summary,
    activeLibraryFile,
    activeSha256,
    isLoading,
    loadingMessage,
    loadLibrary,
    closeLibrary,
    selectedLanguage,
    setSelectedLanguage,
  } = useAppStore();

  const {
    isConnected,
    isSessionExpired,
    isOnline,
    unreadCloudBackupsCount,
    isShaInCloud,
    backupCurrentLibrary,
    isUploading,
    setShowCloudModal,
    initCloud,
  } = useCloudStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>(getThemePreference());
  const [textSize, setTextSize] = useState<TextSizeLevel>(getTextSizePreference());
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const { isInstallable, installPWA } = usePWAInstall();
  const location = useLocation();

  useEffect(() => {
    initCloud();
  }, [initCloud]);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSettingsOpen(false);
  }, [location.pathname]);

  // Close settings dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsOpen]);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isCurrentFileInCloud = activeSha256 ? isShaInCloud(activeSha256) : false;

  const handleQuickCloudUpload = async () => {
    try {
      await backupCurrentLibrary();
    } catch (_) {}
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setThemePreference(newTheme);
  };

  const handleTextSizeChange = (newSize: TextSizeLevel) => {
    setTextSize(newSize);
    setTextSizePreference(newSize);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await loadLibrary(file);
        setMobileMenuOpen(false);
      } catch (_) {}
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-[#070A12]/80 border-b border-slate-200/80 dark:border-white/[0.08] transition-colors duration-150 h-[64px] min-h-[64px] max-h-[64px]">
        <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-[64px] min-h-[64px]">
          <div className="flex items-center justify-between h-[64px] min-h-[64px] gap-4">
            
            {/* ── Brand Logo & Title ───────────────────────────────── */}
            <Link to="/" className="flex items-center space-x-2 sm:space-x-2.5 group flex-shrink-0 min-w-0">
              <img
                src="/logo.jpg"
                alt="Panda JWL-Sync"
                className="w-8 h-8 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/20 shadow-sm group-hover:scale-105 transition-transform flex-shrink-0"
              />
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white flex items-center space-x-1">
                <span className={activeLibraryFile && summary ? 'hidden min-[480px]:inline' : 'inline'}>Panda</span>
                <span className="text-blue-600 dark:text-blue-400">JWL-Sync</span>
              </span>
            </Link>

            {/* Hidden native file input for quick open */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jwlibrary"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* ── Desktop Header Right Controls ─────────────────────── */}
            <div className="hidden md:flex items-center space-x-2.5 flex-shrink-0">
              {/* Secondary Navigation Links: Share & Help */}
              <NavLink
                to="/share"
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
                  }`
                }
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t('nav.share', 'Share')}</span>
              </NavLink>

              <NavLink
                to="/help"
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
                  }`
                }
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{t('nav.help', 'Help')}</span>
              </NavLink>

              <div className="h-4 w-px bg-slate-200 dark:bg-white/[0.1] mx-1" />

              {/* Active Library Indicator or Quick Open */}
              {activeLibraryFile && summary ? (
                <div className="flex items-center space-x-2">
                  <div
                    className="flex items-center space-x-2 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 rounded-xl px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 cursor-help"
                    title={activeLibraryFile instanceof File && activeLibraryFile.name && activeLibraryFile.name !== summary.name
                      ? `${summary.name} (${activeLibraryFile.name})`
                      : summary.name}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                    <span
                      className="font-semibold truncate max-w-[130px] sm:max-w-[180px]"
                      title={activeLibraryFile instanceof File && activeLibraryFile.name && activeLibraryFile.name !== summary.name
                        ? `${summary.name} (${activeLibraryFile.name})`
                        : summary.name}
                    >
                      {summary.name}
                    </span>
                    <button
                      type="button"
                      onClick={closeLibrary}
                      className="text-blue-400 hover:text-red-500 transition-colors p-0.5"
                      title={t('nav.close', 'Close')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Upload Button if not in Cloud */}
                  {isConnected && !isCurrentFileInCloud && (
                    <button
                      type="button"
                      onClick={handleQuickCloudUpload}
                      disabled={isUploading}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all animate-in fade-in"
                      title={t('nav.uploadToDrive', 'Upload to Drive')}
                    >
                      <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                      <span>{isUploading ? t('cloud.uploading', 'Uploading...') : t('nav.uploadToDrive', 'Upload to Drive')}</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] transition-all"
                  title={t('nav.openFile', 'Open File')}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{t('nav.openFile', 'Open File')}</span>
                </button>
              )}

              {/* Google Cloud Sync Button with Offline & Notification Support */}
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isConnected
                    ? isOnline
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : isSessionExpired
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                }`}
                title={
                  isConnected
                    ? isOnline
                      ? 'Google Drive Connected'
                      : 'Google Drive Offline'
                    : isSessionExpired
                    ? t('nav.driveSessionExpiredTooltip', 'Session Google Drive expirée - Cliquez pour reconnecter')
                    : 'Google Drive Cloud Sync'
                }
              >
                {isConnected && !isOnline ? (
                  <WifiOff className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                ) : isSessionExpired ? (
                  <Cloud className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                ) : (
                  <Cloud
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                    }`}
                  />
                )}
                <span>
                  {isConnected
                    ? isOnline
                      ? t('nav.driveConnected', 'Drive Connected')
                      : t('nav.driveOffline', 'Drive Offline')
                    : isSessionExpired
                    ? t('nav.driveSessionExpired', 'Drive Expiré')
                    : t('nav.driveCloud', 'Drive Cloud')}
                </span>
                {isConnected && isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {isConnected && !isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
                {isSessionExpired && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                )}
                {isConnected && isOnline && unreadCloudBackupsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white animate-pulse">
                    +{unreadCloudBackupsCount}
                  </span>
                )}
              </button>

              {/* Unified Preferences / Settings Dropdown */}
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    settingsOpen
                      ? 'bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white border-slate-300 dark:border-white/[0.2]'
                      : 'bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                  }`}
                  title="Preferences"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="uppercase text-[11px] font-bold">{selectedLanguage}</span>
                </button>

                {/* Settings Dropdown Popover */}
                {settingsOpen && (
                  <div
                    style={{ fontSize: '14px' }}
                    className="absolute right-0 top-[calc(100%+8px)] w-[290px] min-w-[290px] max-w-[290px] rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-white/[0.1] shadow-2xl p-[16px] space-y-[14px] z-50 select-none"
                  >
                    {/* Theme selector */}
                    <div className="space-y-[6px]">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('nav.theme', 'Theme')}
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => handleThemeChange('light')}
                          className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            theme === 'light'
                              ? 'bg-white dark:bg-white/[0.1] text-amber-600 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>{t('nav.light', 'Light')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleThemeChange('dark')}
                          className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            theme === 'dark'
                              ? 'bg-white dark:bg-white/[0.1] text-blue-500 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>{t('nav.dark', 'Dark')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleThemeChange('system')}
                          className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            theme === 'system'
                              ? 'bg-white dark:bg-white/[0.1] text-slate-800 dark:text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>{t('nav.system', 'Auto')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Text size selector */}
                    <div className="space-y-[8px]">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                          <Type className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t('nav.textSize', 'Text Size')}</span>
                        </label>
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          {textSize === 1
                            ? '1 • ' + t('nav.textSizeSmall', 'Compacte')
                            : textSize === 2
                            ? '2 • ' + t('nav.textSizeNormal', 'Normale')
                            : textSize === 3
                            ? '3 • ' + t('nav.textSizeLarge', 'Grande')
                            : textSize === 4
                            ? '4 • ' + t('nav.textSizeXLarge', 'Très grande')
                            : '5 • ' + t('nav.textSizeMax', 'Maximale')}
                        </span>
                      </div>
                      <div className="bg-slate-100 dark:bg-white/[0.04] p-[12px] rounded-xl border border-slate-200/60 dark:border-white/[0.06] space-y-[12px]">
                        <div className="flex items-center space-x-[12px]">
                          <span className="w-[20px] text-center text-[12px] font-semibold text-slate-400 dark:text-slate-500 select-none flex-shrink-0">A</span>
                          <div className="relative flex-1 flex items-center">
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={textSize}
                              onChange={(e) => handleTextSizeChange(Number(e.target.value) as TextSizeLevel)}
                              aria-label={t('nav.textSize', 'Text Size')}
                              className="w-full h-[8px] bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none touch-none"
                            />
                          </div>
                          <span className="w-[20px] text-center text-[18px] font-black text-slate-800 dark:text-slate-200 select-none flex-shrink-0">A</span>
                        </div>
                        {/* 5 discrete clickable level buttons for 1-click precision */}
                        <div className="grid grid-cols-5 gap-[6px]">
                          {([1, 2, 3, 4, 5] as const).map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => handleTextSizeChange(step)}
                              aria-label={`Text size ${step}`}
                              className={`py-[5px] rounded-lg text-[11px] font-bold transition-all text-center ${
                                textSize === step
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                                  : 'bg-white/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]'
                              }`}
                            >
                              {step}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Language selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('nav.language', 'Language')}
                      </label>
                      <select
                        aria-label="Language selector"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code} className="bg-white text-slate-900 dark:bg-[#0e1422] dark:text-slate-200">
                            {lang.nativeName} ({lang.wtlocale})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* PWA Install Button if available */}
                    {isInstallable && (
                      <button
                        type="button"
                        onClick={() => {
                          installPWA();
                          setSettingsOpen(false);
                        }}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('nav.installApp', 'Install App')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile Header Controls (< md) ──────────────────── */}
            <div className="flex md:hidden items-center space-x-1.5 sm:space-x-2 min-w-0">
              {/* Active Library Indicator on Mobile */}
              {activeLibraryFile && summary && (
                <div
                  className="flex items-center space-x-1.5 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 rounded-xl px-2.5 py-1.5 text-xs text-blue-700 dark:text-blue-300 max-w-[120px] min-[360px]:max-w-[145px] min-[420px]:max-w-[180px] min-w-0 shadow-sm"
                  title={activeLibraryFile instanceof File && activeLibraryFile.name && activeLibraryFile.name !== summary.name
                    ? `${summary.name} (${activeLibraryFile.name})`
                    : summary.name}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                  <span
                    className="font-semibold truncate text-xs"
                    title={activeLibraryFile instanceof File && activeLibraryFile.name && activeLibraryFile.name !== summary.name
                      ? `${summary.name} (${activeLibraryFile.name})`
                      : summary.name}
                  >
                    {summary.name}
                  </span>
                  <button
                    type="button"
                    onClick={closeLibrary}
                    className="text-blue-400 hover:text-red-500 transition-colors p-0.5 flex-shrink-0 ml-0.5"
                    title={t('nav.close', 'Close')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className={`relative p-2 rounded-xl border text-xs font-semibold transition-all flex-shrink-0 ${
                  isConnected
                    ? isOnline
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                    : isSessionExpired
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                    : 'bg-slate-100 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400'
                }`}
                title={
                  isConnected
                    ? (isOnline ? 'Google Drive Connected' : 'Google Drive Offline')
                    : isSessionExpired
                    ? t('nav.driveSessionExpiredTooltip', 'Session Google Drive expirée - Cliquez pour reconnecter')
                    : 'Google Drive Cloud'
                }
              >
                {isConnected && !isOnline ? (
                  <WifiOff className="w-4 h-4 text-amber-500" />
                ) : isSessionExpired ? (
                  <Cloud className="w-4 h-4 text-amber-500" />
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
                {isSessionExpired && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
                {isConnected && isOnline && unreadCloudBackupsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCloudBackupsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 flex-shrink-0"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Loading banner */}
        {isLoading && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white text-xs px-4 py-1.5 flex items-center justify-center space-x-2 font-medium">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>{loadingMessage || 'Processing in local WebAssembly SQLite...'}</span>
          </div>
        )}
      </header>

      {/* ── Mobile Drawer (< md) ─────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div
            style={{ fontSize: '14px' }}
            className="relative bg-white dark:bg-[#0e1422] border-t border-slate-200 dark:border-white/[0.1] rounded-t-3xl shadow-2xl p-[20px] max-h-[85vh] overflow-y-auto space-y-[16px] animate-in slide-in-from-bottom duration-200 select-none"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <img src="/logo.jpg" alt="Logo" className="w-6 h-6 rounded-lg object-cover" />
                <span className="font-bold text-base text-slate-900 dark:text-white">Panda JWL-Sync</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active library status card or Quick Open in mobile drawer */}
            {activeLibraryFile && summary ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      {t('landing.activeLibraryBanner', 'Active Library Loaded')}
                    </p>
                    <p
                      className="text-xs font-bold text-blue-900 dark:text-blue-100 truncate"
                      title={activeLibraryFile instanceof File && activeLibraryFile.name && activeLibraryFile.name !== summary.name
                        ? `${summary.name} (${activeLibraryFile.name})`
                        : summary.name}
                    >
                      {summary.name}
                    </p>
                    {summary.deviceName && (
                      <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 truncate">
                        {summary.deviceName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                  {isConnected && !isCurrentFileInCloud && (
                    <button
                      type="button"
                      onClick={() => {
                        handleQuickCloudUpload();
                        setMobileMenuOpen(false);
                      }}
                      disabled={isUploading}
                      className="p-2 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-500 transition-colors"
                      title={t('nav.uploadToDrive', 'Upload to Drive')}
                    >
                      <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      closeLibrary();
                      setMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-xl text-blue-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title={t('nav.close', 'Close')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setMobileMenuOpen(false);
                }}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold transition-all"
              >
                <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{t('nav.openFile', 'Open File')}</span>
              </button>
            )}

            {/* Mobile Navigation links */}
            <nav className="space-y-1">
              <NavLink
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              >
                <GitMerge className="w-4 h-4 text-blue-600" />
                <span>{t('nav.merge', 'Merge')}</span>
              </NavLink>

              <NavLink
                to="/explorer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              >
                <BookOpen className="w-4 h-4 text-sky-600" />
                <span>{t('nav.explorer', 'Explorer')}</span>
              </NavLink>

              <NavLink
                to="/stats"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              >
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>{t('nav.analytics', 'Stats')}</span>
              </NavLink>

              <NavLink
                to="/share"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              >
                <Share2 className="w-4 h-4 text-indigo-500" />
                <span>{t('nav.share', 'Share')}</span>
              </NavLink>

              <NavLink
                to="/help"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              >
                <HelpCircle className="w-4 h-4 text-emerald-500" />
                <span>{t('nav.help', 'Help')}</span>
              </NavLink>
            </nav>

            {/* Theme selector in mobile drawer */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('nav.theme', 'Theme')}
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-semibold ${
                    theme === 'light' ? 'bg-white dark:bg-white/[0.1] text-amber-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{t('nav.light', 'Light')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-semibold ${
                    theme === 'dark' ? 'bg-white dark:bg-white/[0.1] text-blue-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{t('nav.dark', 'Dark')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-semibold ${
                    theme === 'system' ? 'bg-white dark:bg-white/[0.1] text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{t('nav.system', 'Auto')}</span>
                </button>
              </div>
            </div>

            {/* Text size selector in mobile drawer */}
            <div className="space-y-[8px]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('nav.textSize', 'Text Size')}</span>
                </label>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {textSize === 1
                    ? '1 • ' + t('nav.textSizeSmall', 'Compacte')
                    : textSize === 2
                    ? '2 • ' + t('nav.textSizeNormal', 'Normale')
                    : textSize === 3
                    ? '3 • ' + t('nav.textSizeLarge', 'Grande')
                    : textSize === 4
                    ? '4 • ' + t('nav.textSizeXLarge', 'Très grande')
                    : '5 • ' + t('nav.textSizeMax', 'Maximale')}
                </span>
              </div>
              <div className="bg-slate-100 dark:bg-white/[0.04] p-[12px] rounded-xl border border-slate-200/60 dark:border-white/[0.06] space-y-[12px]">
                <div className="flex items-center space-x-[12px]">
                  <span className="w-[20px] text-center text-[12px] font-semibold text-slate-400 dark:text-slate-500 select-none flex-shrink-0">A</span>
                  <div className="relative flex-1 flex items-center">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={textSize}
                      onChange={(e) => handleTextSizeChange(Number(e.target.value) as TextSizeLevel)}
                      aria-label={t('nav.textSize', 'Text Size')}
                      className="w-full h-[8px] bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none touch-none"
                    />
                  </div>
                  <span className="w-[20px] text-center text-[18px] font-black text-slate-800 dark:text-slate-200 select-none flex-shrink-0">A</span>
                </div>
                {/* 5 discrete clickable level buttons for 1-click precision */}
                <div className="grid grid-cols-5 gap-[6px]">
                  {([1, 2, 3, 4, 5] as const).map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => handleTextSizeChange(step)}
                      aria-label={`Text size ${step}`}
                      className={`py-[6px] rounded-lg text-[11px] font-bold transition-all text-center ${
                        textSize === step
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                          : 'bg-white/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]'
                      }`}
                    >
                      {step}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Language selector in mobile drawer */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('nav.language', 'Language')}
              </label>
              <select
                aria-label="Language selector"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 font-medium"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.wtlocale})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
