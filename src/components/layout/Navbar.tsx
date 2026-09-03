import React, { useRef, useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { X } from 'lucide-react';
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

  useEffect(() => {
    initCloud();
  }, [initCloud]);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setThemePreference(newTheme);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await loadLibrary(file);
      } catch (_) {}
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const navItems = [
    { to: '/', label: 'Overview', iconName: 'explore' },
    { to: '/merge', label: 'Merge', iconName: 'call_merge' },
    { to: '/explorer', label: 'Explorer', iconName: 'menu_book' },
    { to: '/stats', label: 'Analytics', iconName: 'bar_chart' },
    { to: '/share', label: 'Share', iconName: 'ios_share' },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-[#0B0F19]/90 border-b border-slate-200 dark:border-white/[0.08] transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center space-x-2.5 group flex-shrink-0">
            <img
              src="/logo.jpg"
              alt="Panda JWL-Sync"
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/20 shadow-md group-hover:scale-105 transition-transform"
            />
            <div className="flex items-baseline space-x-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white flex flex-col leading-tight whitespace-nowrap">
                <span>Panda</span>
                <span className="text-blue-600 dark:text-blue-500">JWL-Sync</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav links (Direct sibling, visible on xl: 1280px+) */}
          <nav className="hidden xl:flex items-center space-x-1 bg-slate-100/80 dark:bg-white/[0.02] p-1 rounded-xl border border-slate-200 dark:border-white/[0.05] flex-shrink-0">
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

          {/* Right utility controls */}
          <div className="flex items-center space-x-1 sm:space-x-2 xl:space-x-2.5 flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jwlibrary"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Google Cloud Sync Button */}
            <button
              type="button"
              onClick={() => setShowCloudModal(true)}
              className={`flex items-center space-x-1.5 px-2 sm:px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
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

            {/* Active Library Pill */}
            {activeLibraryFile && summary ? (
              <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.1] rounded-xl px-2 sm:px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300">
                <GoogleIcon name="inventory_2" className="text-base text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex flex-col text-left max-w-[80px] sm:max-w-[120px] xl:max-w-[170px]">
                  <span className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">{summary.name}</span>
                  <span className="hidden xl:inline text-slate-500 dark:text-slate-400 text-[10px] truncate">
                    {summary.notesCount} notes • {summary.tagsCount} tags
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-medium ml-0.5 sm:ml-1"
                >
                  Swap
                </button>
                <button
                  type="button"
                  onClick={closeLibrary}
                  className="text-slate-400 hover:text-red-500 p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] transition-all"
                  title="Open local .jwlibrary file"
                >
                  <GoogleIcon name="folder_open" className="text-base text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Open File</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoLibrary('example2')}
                  disabled={isLoading}
                  className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-all shadow-sm"
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
                  className="bg-transparent text-slate-700 dark:text-slate-300 text-[11px] font-medium focus:outline-none cursor-pointer max-w-[70px] sm:max-w-none"
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
        </div>

        {/* Mobile / Tablet Navigation bar */}
        <div className="flex xl:hidden items-center justify-start sm:justify-around py-2 px-1 border-t border-slate-200 dark:border-white/[0.06] overflow-x-auto no-scrollbar text-xs gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap text-xs flex-shrink-0 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`
              }
            >
              <GoogleIcon name={item.iconName} className="text-base" />
              <span>{item.label}</span>
            </NavLink>
          ))}
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
  );
};
