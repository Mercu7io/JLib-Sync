import React, { useRef, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { X, Menu, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCloudStore } from '../../store/useCloudStore';
import { SUPPORTED_LANGUAGES } from '../../lib/jw/locales';
import { getThemePreference, setThemePreference, ThemeMode } from '../../lib/theme';
import { GoogleIcon } from '../common/GoogleIcon';

export const Navbar: React.FC = () => {
  const {
    summary,
    activeLibraryFile,
    isLoading,
    loadingMessage,
    loadLibrary,
    loadDemoLibrary,
    closeLibrary,
    selectedLanguage,
    setSelectedLanguage,
  } = useAppStore();

  const { isConnected, setShowCloudModal, initCloud } = useCloudStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<ThemeMode>(getThemePreference());
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    initCloud();
  }, [initCloud]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scrolling when mobile drawer is open
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

  const cycleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    handleThemeChange(next);
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
    { to: '/', label: 'Overview', iconName: 'explore', desc: 'Home & capabilities' },
    { to: '/merge', label: 'Merge', iconName: 'call_merge', desc: 'Combine two backups' },
    { to: '/explorer', label: 'Explorer', iconName: 'menu_book', desc: 'Notes, tags & bookmarks' },
    { to: '/stats', label: 'Analytics', iconName: 'bar_chart', desc: 'Reading stats & metrics' },
    { to: '/share', label: 'Share', iconName: 'ios_share', desc: 'Selective export' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-[#0B0F19]/90 border-b border-slate-200 dark:border-white/[0.08] transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Brand Logo & Name */}
            <Link to="/" className="flex items-center space-x-2 sm:space-x-2.5 group flex-shrink-0">
              <img
                src="/logo.jpg"
                alt="Panda JWL-Sync"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/20 shadow-md group-hover:scale-105 transition-transform"
              />
              <div className="flex items-baseline space-x-1 sm:space-x-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white flex flex-col sm:flex-row sm:space-x-1 leading-tight whitespace-nowrap">
                  <span>Panda</span>
                  <span className="text-blue-600 dark:text-blue-500">JWL-Sync</span>
                </span>
              </div>
            </Link>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jwlibrary"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Desktop Nav links (Direct center sibling on lg: 1024px+) */}
            <nav className="hidden lg:flex items-center space-x-1 bg-slate-100/80 dark:bg-white/[0.02] p-1 rounded-xl border border-slate-200 dark:border-white/[0.05] flex-shrink-0">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <GoogleIcon name={item.iconName} className="text-base flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Desktop Right utility controls (Visible on lg: 1024px+) */}
            <div className="hidden lg:flex items-center space-x-2 xl:space-x-2.5 flex-shrink-0">
              {/* Google Cloud Sync Button */}
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className={`flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isConnected
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:border-blue-500/40'
                }`}
                title="Google Drive Cloud Sync"
              >
                <GoogleIcon
                  name="cloud_sync"
                  className={`text-base flex-shrink-0 ${isConnected ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                />
                <span className="hidden xl:inline whitespace-nowrap">Drive Cloud</span>
                {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />}
              </button>

              {/* Active Library Pill or Open/Demo buttons */}
              {activeLibraryFile && summary ? (
                <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <GoogleIcon name="inventory_2" className="text-base text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex flex-col text-left max-w-[100px] xl:max-w-[150px]">
                    <span className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">{summary.name}</span>
                    <span className="hidden xl:inline text-slate-500 dark:text-slate-400 text-[10px] truncate">
                      {summary.notesCount} notes • {summary.tagsCount} tags
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-medium ml-1"
                  >
                    Swap
                  </button>
                  <button
                    type="button"
                    onClick={closeLibrary}
                    className="text-slate-400 hover:text-red-500 p-0.5 transition-colors ml-0.5"
                    title="Close library"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] transition-all"
                    title="Open local .jwlibrary file"
                  >
                    <GoogleIcon name="folder_open" className="text-base text-blue-600 dark:text-blue-400" />
                    <span>Open File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadDemoLibrary('example2')}
                    disabled={isLoading}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-all shadow-sm"
                    title="Load sample library"
                  >
                    <GoogleIcon name="auto_awesome" className="text-sm text-blue-500 dark:text-blue-400" fill />
                    <span>Demo</span>
                  </button>
                </div>
              )}

              {/* Language dropdown */}
              <div className="relative">
                <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-2 py-1.5 transition-colors">
                  <GoogleIcon name="language" className="text-base text-slate-500 dark:text-slate-400 flex-shrink-0" />
                  <select
                    aria-label="Language selector"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="bg-transparent text-slate-700 dark:text-slate-300 text-[11px] font-medium focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-white text-slate-900 dark:bg-[#0e1422] dark:text-slate-200">
                        {lang.nativeName} ({lang.wtlocale})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme selector (Light / Dark / System) */}
              <div className="relative">
                <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-2 py-1.5 transition-colors">
                  <GoogleIcon
                    name={theme === 'light' ? 'light_mode' : theme === 'dark' ? 'dark_mode' : 'desktop_windows'}
                    className={`text-base flex-shrink-0 ${theme === 'light' ? 'text-amber-500' : theme === 'dark' ? 'text-blue-400' : 'text-slate-400'}`}
                    fill={theme !== 'system'}
                  />
                  <select
                    aria-label="Theme mode"
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value as ThemeMode)}
                    className="bg-transparent text-slate-700 dark:text-slate-300 text-[11px] font-medium focus:outline-none cursor-pointer capitalize"
                  >
                    <option value="light" className="bg-white text-slate-900 dark:bg-[#0e1422] dark:text-slate-200">
                      Light
                    </option>
                    <option value="dark" className="bg-white text-slate-900 dark:bg-[#0e1422] dark:text-slate-200">
                      Dark
                    </option>
                    <option value="system" className="bg-white text-slate-900 dark:bg-[#0e1422] dark:text-slate-200">
                      System
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile Right Controls (Compact & Ultra Responsive, < 1024px) */}
            <div className="flex lg:hidden items-center space-x-1.5 flex-shrink-0">
              {/* Drive Cloud quick icon */}
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all relative ${
                  isConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400'
                }`}
                title="Google Drive Cloud Sync"
                aria-label="Google Drive Cloud"
              >
                <GoogleIcon name="cloud_sync" className="text-xl" />
                {isConnected && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>

              {/* Quick theme toggle */}
              <button
                type="button"
                onClick={cycleTheme}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 transition-colors"
                title={`Theme mode: ${theme}`}
                aria-label="Toggle Theme"
              >
                <GoogleIcon
                  name={theme === 'light' ? 'light_mode' : theme === 'dark' ? 'dark_mode' : 'desktop_windows'}
                  className={`text-xl ${theme === 'light' ? 'text-amber-500' : theme === 'dark' ? 'text-blue-400' : 'text-slate-400'}`}
                />
              </button>

              {/* Hamburger Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`p-2 rounded-xl transition-all border ${
                  mobileMenuOpen
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-slate-100 dark:bg-white/[0.04] text-slate-800 dark:text-slate-100 border-slate-200 dark:border-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.08]'
                }`}
                aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
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

      {/* ── MOBILE MENU DRAWER OVERLAY (< lg: 1024px) ───────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          {/* Backdrop backdrop-blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-up / Drawer Panel */}
          <div className="relative bg-white dark:bg-[#0e1422] border-t border-slate-200 dark:border-white/[0.1] rounded-t-3xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto space-y-5 animate-in slide-in-from-bottom duration-250">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <img src="/logo.jpg" alt="Logo" className="w-6 h-6 rounded-md object-cover" />
                <span className="font-bold text-base text-slate-900 dark:text-white">Menu & Navigation</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Library Status Card */}
            {activeLibraryFile && summary ? (
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <GoogleIcon name="inventory_2" className="text-xl text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{summary.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {summary.notesCount} notes • {summary.userMarksCount} highlights • {summary.tagsCount} tags
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1 border-t border-blue-500/20 text-xs">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-center hover:bg-blue-500"
                  >
                    Swap File
                  </button>
                  <button
                    type="button"
                    onClick={closeLibrary}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-medium hover:text-red-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center space-x-1.5 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <GoogleIcon name="folder_open" className="text-lg" />
                  <span>Open .jwlibrary</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadDemoLibrary('example2');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center space-x-1.5 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/[0.08] font-bold text-xs transition-colors"
                >
                  <GoogleIcon name="auto_awesome" className="text-lg text-blue-500" fill />
                  <span>Load Sample</span>
                </button>
              </div>
            )}

            {/* Google Drive Status Bar */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowCloudModal(true);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <GoogleIcon
                  name="cloud_sync"
                  className={`text-xl ${isConnected ? 'text-emerald-500' : 'text-slate-500'}`}
                />
                <span className="font-bold">
                  {isConnected ? 'Google Drive Connected ✓' : 'Connect Google Drive Cloud'}
                </span>
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                {isConnected ? 'Manage' : 'Connect →'}
              </span>
            </button>

            {/* Navigation Pages List */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                Pages & Tools
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between p-3 rounded-xl transition-all text-xs font-semibold ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-50 dark:bg-white/[0.02] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <GoogleIcon name={item.iconName} className="text-xl" fill={isActive} />
                        <div>
                          <div className="font-bold">{item.label}</div>
                          <div className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs ${isActive ? 'text-white' : 'text-slate-400'}`}>→</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Language & Theme Controls */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
              {/* Language */}
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Language</span>
                <div className="flex items-center space-x-1.5 p-2 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs">
                  <GoogleIcon name="language" className="text-base text-slate-500" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none w-full cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-white text-slate-900 dark:bg-[#0e1422] dark:text-slate-200">
                        {lang.nativeName} ({lang.wtlocale})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme */}
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Theme</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-1 rounded-xl text-xs">
                  {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleThemeChange(t)}
                      className={`py-1 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                        theme === t
                          ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick External Links */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
              <a
                href="https://redpandaium.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-blue-500 inline-flex items-center space-x-1"
              >
                <span>redpandaium.com</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href="https://github.com/Mercu7io/JLib-Sync"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-blue-500 inline-flex items-center space-x-1"
              >
                <span>GitHub</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE FIXED BOTTOM NAVIGATION BAR (< lg: 1024px) ───────────────── */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.08] lg:hidden shadow-lg"
      >
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 text-[10px] font-semibold transition-all ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-500/15 scale-110' : ''}`}>
                    <GoogleIcon name={item.iconName} className="text-xl" fill={isActive} />
                  </div>
                  <span className="truncate max-w-[60px] text-[10px] mt-0.5">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};
