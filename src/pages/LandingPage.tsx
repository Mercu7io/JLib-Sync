import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Smartphone, Tablet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { useCloudStore } from '../store/useCloudStore';
import { GoogleIcon } from '../components/common/GoogleIcon';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadLibrary, loadDemoLibrary, summary, isLoading } = useAppStore();
  const { isConnected, setShowCloudModal } = useCloudStore();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadLibrary(file);
      navigate('/explorer');
    }
  };

  const handleDemoClick = async (demoKey: 'example' | 'example2') => {
    await loadDemoLibrary(demoKey);
    navigate('/explorer');
  };

  return (
    <div className="relative overflow-hidden pb-24 space-y-20">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-blue-600/15 via-indigo-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      <input
        ref={fileInputRef}
        type="file"
        accept=".jwlibrary"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ── SECTION 1: HERO HEADER & TRUST BADGE ───────────────────────── */}
      <section className="pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6">
        {/* Floating glassmorphic trust badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold backdrop-blur-md shadow-sm">
          <GoogleIcon name="verified_user" className="text-base text-emerald-500 dark:text-emerald-400" fill />
          <span>{t('landing.privacyBadge')}</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
          {t('landing.heroTitle')}
        </h1>

        {/* Subheadline & Crux copy */}
        <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
          {t('landing.heroSubtitle')}
        </p>

        {/* Action Button Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            to="/merge"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <GoogleIcon name="call_merge" className="text-lg" />
            <span>{t('landing.mergeCta')}</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </Link>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.1] font-semibold text-sm transition-all shadow-sm"
          >
            <GoogleIcon name="folder_open" className="text-lg text-blue-600 dark:text-blue-400" />
            <span>{t('landing.openLocal')}</span>
          </button>
        </div>

        {/* Quick Demo Samples */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{t('nav.loadSample')}:</span>
          <button
            type="button"
            onClick={() => handleDemoClick('example')}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-[11px]"
          >
            {t('landing.sampleA')}
          </button>
          <button
            type="button"
            onClick={() => handleDemoClick('example2')}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-[11px]"
          >
            {t('landing.sampleB')}
          </button>
        </div>
      </section>

      {/* ── SECTION 2: DUAL DOCK (LOCAL FILE vs GOOGLE DRIVE) ─────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Local Client-Side File */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer rounded-2xl bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 p-7 space-y-4 transition-all shadow-sm hover:shadow-xl hover:shadow-blue-950/10 backdrop-blur-xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <GoogleIcon name="folder_open" className="text-2xl" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                100% Private
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Open Local .jwlibrary File
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Drag & drop or browse a backup file directly from your computer. Processed entirely in-memory using WebAssembly SQLite.
              </p>
            </div>

            <div className="pt-2 flex items-center space-x-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Select File from Disk</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Google Drive Cloud Sync */}
          <div
            onClick={() => setShowCloudModal(true)}
            className="group cursor-pointer rounded-2xl bg-white dark:bg-[#111726]/80 border border-slate-200 dark:border-white/[0.08] hover:border-sky-500/50 p-7 space-y-4 transition-all shadow-sm hover:shadow-xl hover:shadow-sky-950/10 backdrop-blur-xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                <GoogleIcon name="cloud_sync" className="text-2xl" />
              </div>
              {isConnected ? (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span>Drive Connected</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Cloud Storage
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Connect Google Drive Sync
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Save merged libraries to your personal Google Drive, batch delete old versions, and select 2 cloud files to merge instantly.
              </p>
            </div>

            <div className="pt-2 flex items-center space-x-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <span>{isConnected ? 'Manage Cloud Backups' : 'Connect Account'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE CRUX (WHY OFFICIAL RESTORE LEAVES YOU TRAPPED) ─ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-100/80 dark:bg-[#0e1422]/90 border border-slate-200 dark:border-white/[0.08] p-6 sm:p-10 space-y-8 backdrop-blur-xl">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Why Official Restore Leaves You Trapped
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Restoring a backup is a full swap, not a merge. If you study on both your phone and tablet, one always gets deleted.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Trap */}
            <div className="rounded-2xl border border-red-300 dark:border-red-900/40 bg-white/70 dark:bg-gradient-to-b dark:from-red-950/20 dark:to-transparent p-6 space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 font-bold text-sm">
                <GoogleIcon name="warning" className="text-lg text-red-500" fill />
                <span>Default Restore (Destructive Full Swap)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You prepared your Watchtower comments on your tablet at home, but took meeting notes on your phone.
              </p>
              <div className="bg-slate-50 dark:bg-[#0b0f19] border border-red-200 dark:border-red-900/30 rounded-xl p-4 text-xs space-y-2.5 text-slate-700 dark:text-slate-300">
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <Tablet className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                  <span>Tablet: 42 Watchtower highlights & comments</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <Smartphone className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                  <span>Phone: 18 Midweek meeting notes & cross-refs</span>
                </div>
                <div className="pt-2 border-t border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-300 font-medium">
                  Outcome: Restoring one deletes the other. You lose personal research.
                </div>
              </div>
            </div>

            {/* The Solution */}
            <div className="rounded-2xl border border-blue-300 dark:border-blue-500/40 bg-white/70 dark:bg-gradient-to-b dark:from-blue-950/20 dark:to-transparent p-6 space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <GoogleIcon name="check_circle" className="text-lg text-emerald-500 dark:text-emerald-400" fill />
                <span>Panda JWL-Sync (Non-Destructive Merge)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Combines both databases into one verified package that JW Library restores without losing either side.
              </p>
              <div className="bg-slate-50 dark:bg-[#0b0f19] border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 text-xs space-y-2.5 text-slate-700 dark:text-slate-300">
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <GoogleIcon name="check" className="text-base text-emerald-500 dark:text-emerald-400" />
                  <span>Matches identical verses & paragraphs automatically</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <GoogleIcon name="check" className="text-base text-emerald-500 dark:text-emerald-400" />
                  <span>Consolidates tags and preserves teaching media</span>
                </div>
                <div className="pt-2 border-t border-blue-200 dark:border-blue-500/30 text-emerald-600 dark:text-emerald-300 font-medium">
                  Outcome: 60 notes & highlights combined. Both devices stay synchronized.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: BENTO GRID OF 4 SUPERPOWERS ────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('landing.superpowersTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('landing.superpowersSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Multi-Library Merge */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/75 p-6 space-y-3 hover:border-blue-500/40 transition-all shadow-sm hover:shadow-md backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GoogleIcon name="call_merge" className="text-xl" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('landing.power1Title')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('landing.power1Desc')}
            </p>
            <div className="pt-2">
              <Link to="/merge" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1">
                <span>{t('landing.power1Link')}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* 2. Selective Sharing */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/75 p-6 space-y-3 hover:border-emerald-500/40 transition-all shadow-sm hover:shadow-md backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <GoogleIcon name="ios_share" className="text-xl" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('landing.power2Title')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('landing.power2Desc')}
            </p>
            <div className="pt-2">
              <Link to="/share" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center space-x-1">
                <span>{t('landing.power2Link')}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* 3. The Tag Manager */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/75 p-6 space-y-3 hover:border-sky-500/40 transition-all shadow-sm hover:shadow-md backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <GoogleIcon name="label" className="text-xl" fill />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('landing.power3Title')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('landing.power3Desc')}
            </p>
            <div className="pt-2">
              <Link to="/explorer" className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center space-x-1">
                <span>{t('landing.power3Link')}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* 4. Reading Analytics */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111726]/75 p-6 space-y-3 hover:border-purple-500/40 transition-all shadow-sm hover:shadow-md backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GoogleIcon name="bar_chart" className="text-xl" fill />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('landing.power4Title')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('landing.power4Desc')}
            </p>
            <div className="pt-2">
              <Link to="/stats" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center space-x-1">
                <span>{t('landing.power4Link')}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Active Library Bar */}
      {summary && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-blue-200 dark:border-blue-500/40 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/15 dark:via-indigo-500/10 dark:to-transparent p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center space-x-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <GoogleIcon name="inventory_2" className="text-xl" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Library Loaded: {summary.name}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {summary.notesCount} notes • {summary.userMarksCount} highlights • {summary.tagsCount} tags • {summary.deviceName}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Link
                to="/explorer"
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-md shadow-blue-600/20 text-center"
              >
                Go to Study Explorer →
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
