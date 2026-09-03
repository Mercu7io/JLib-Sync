import React, { useRef, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { X, Menu, Settings, Sun, Moon, Monitor, Download, ExternalLink, Cloud } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCloudStore } from '../../store/useCloudStore';
import { SUPPORTED_LANGUAGES } from '../../lib/jw/locales';
import { getThemePreference, setThemePreference, ThemeMode } from '../../lib/theme';
import { GoogleIcon } from '../common/GoogleIcon';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useTranslation } from 'react-i18next';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const {
    summary,
    activeLibraryFile,
    isLoading,
    loadingMessage,
    loadLibrary,
    closeLibrary,
    selectedLanguage,
    setSelectedLanguage,
  } = useAppStore();

  const { isConnected, setShowCloudModal, initCloud } = useCloudStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>(getThemePreference());
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

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setThemePreference(newTheme);
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

  const navItems = [
    { to: '/merge', label: t('nav.merge'), iconName: 'call_merge' },
    { to: '/explorer', label: t('nav.explorer'), iconName: 'menu_book' },
    { to: '/share', label: t('nav.share'), iconName: 'ios_share' },
    { to: '/stats', label: t('nav.analytics'), iconName: 'bar_chart' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-[#0B0F19]/90 border-b border-slate-200/80 dark:border-white/[0.08] transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* ── Brand Logo & Title ───────────────────────────────── */}
            <Link to="/" className="flex items-center space-x-2.5 group flex-shrink-0">
              <img
                src="/logo.jpg"
                alt="Panda JWL-Sync"
                className="w-8 h-8 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/20 shadow-sm group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white flex items-center space-x-1">
                <span>Panda</span>
                <span className="text-blue-600 dark:text-blue-500">JWL-Sync</span>
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

            {/* ── Desktop Nav Links (Clean Pills) ─────────────────── */}
            <nav className="hidden md:flex items-center space-x-1 bg-slate-100/70 dark:bg-white/[0.03] p-1 rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-white dark:bg-white/[0.1] text-blue-600 dark:text-white shadow-sm border border-slate-200/50 dark:border-transparent'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`
                  }
                >
                  <GoogleIcon name={item.iconName} className="text-base flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* ── Desktop Right Controls (Clean, uncluttered) ────── */}
            <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
              {/* Active Library Indicator or Quick Open */}
              {activeLibraryFile && summary ? (
                <div className="flex items-center space-x-2 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 rounded-xl px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                  <span className="font-semibold truncate max-w-[130px]">{summary.name}</span>
                  <button
                    type="button"
                    onClick={closeLibrary}
                    className="text-blue-400 hover:text-red-500 transition-colors p-0.5"
                    title={t('nav.close')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] transition-all"
                  title={t('nav.openFile')}
                >
                  <GoogleIcon name="folder_open" className="text-base text-blue-600 dark:text-blue-400" />
                  <span>{t('nav.openFile')}</span>
                </button>
              )}

              {/* Google Cloud Sync Button */}
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isConnected
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                }`}
                title="Google Drive Cloud Sync"
              >
                <Cloud className={`w-3.5 h-3.5 flex-shrink-0 ${isConnected ? 'text-emerald-500' : 'text-slate-500'}`} />
                <span>{t('nav.driveCloud')}</span>
                {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>

              {/* Unified Preferences / Settings Dropdown */}
              <div className="relative" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    settingsOpen
                      ? 'bg-slate-200 dark:bg-white/[0.1] text-slate-900 dark:text-white border-slate-300 dark:border-white/[0.2]'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                  }`}
                  title="Preferences"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Settings Dropdown Popover */}
                {settingsOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-white/[0.1] shadow-xl p-4 space-y-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Theme selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('nav.theme')}
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
                          <span>{t('nav.light')}</span>
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
                          <span>{t('nav.dark')}</span>
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
                          <span>{t('nav.system')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Language selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('nav.language')}
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
                        <span>{t('nav.installApp')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile Header Controls (< md) ──────────────────── */}
            <div className="flex md:hidden items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                  isConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                    : 'bg-slate-100 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400'
                }`}
                title="Google Drive Cloud"
              >
                <Cloud className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200"
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
            <span>{loadingMessage || 'Processing client-side in WebAssembly...'}</span>
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

          <div className="relative bg-white dark:bg-[#0e1422] border-t border-slate-200 dark:border-white/[0.1] rounded-t-3xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto space-y-6 animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
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

            {/* Active Library or Open button in mobile drawer */}
            {activeLibraryFile && summary ? (
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{summary.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {summary.notesCount} notes • {summary.userMarksCount} highlights
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeLibrary}
                    className="p-1 text-slate-400 hover:text-red-500"
                    title={t('nav.close')}
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
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm"
              >
                <GoogleIcon name="folder_open" className="text-base" />
                <span>{t('nav.openFile')}</span>
              </button>
            )}

            {/* Navigation items */}
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <GoogleIcon name={item.iconName} className="text-xl flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Theme selector in mobile drawer */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('nav.theme')}
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
                  <span>{t('nav.light')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-semibold ${
                    theme === 'dark' ? 'bg-white dark:bg-white/[0.1] text-blue-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{t('nav.dark')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-semibold ${
                    theme === 'system' ? 'bg-white dark:bg-white/[0.1] text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{t('nav.system')}</span>
                </button>
              </div>
            </div>

            {/* Language selector in mobile drawer */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('nav.language')}
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

            {/* Install PWA Button in mobile drawer */}
            {isInstallable && (
              <button
                type="button"
                onClick={() => {
                  installPWA();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{t('nav.installApp')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
