import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Cloud, FolderOpen, GitMerge, Sparkles, CheckCircle2 } from 'lucide-react';
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
    <div className="relative overflow-hidden pb-16 space-y-12">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <input
        ref={fileInputRef}
        type="file"
        accept=".jwlibrary"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ── HERO SECTION ───────────────────────────────────────────── */}
      <section className="pt-10 sm:pt-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center space-y-5">
        {/* Discreet Privacy Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t('landing.privacyBadge', '100% Client-Side Privacy • In-Memory Processing')}</span>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
          {t('landing.heroTitle')}
        </h1>

        {/* Concise Subtitle */}
        <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {t('landing.heroSubtitle')}
        </p>

        {/* Active Library Bar if loaded */}
        {summary && (
          <div className="pt-2 max-w-md mx-auto">
            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 p-3.5 flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {summary.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {summary.notesCount} notes • {summary.userMarksCount} highlights
                </div>
              </div>
              <Link
                to="/explorer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all flex-shrink-0"
              >
                Explorer →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ── DUAL ACTION CARDS (FOCUSED & DIRECT) ────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Card 1: Merge Two Backups (Primary Tool) */}
          <Link
            to="/merge"
            className="group relative rounded-3xl bg-white dark:bg-[#101625] border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 p-6 sm:p-8 space-y-5 transition-all shadow-sm hover:shadow-xl hover:shadow-blue-950/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <GitMerge className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t('landing.mergeCta', 'Merge Two Libraries')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                  Combine tablet and phone backups without losing notes, tags, or highlights. Smart conflict resolution included.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>{t('landing.power1Link', 'Open Merge Tool')}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Open Single Library (Explorer / Sharing / Stats) */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer rounded-3xl bg-white dark:bg-[#101625] border border-slate-200 dark:border-white/[0.08] hover:border-sky-500/50 p-6 sm:p-8 space-y-5 transition-all shadow-sm hover:shadow-xl hover:shadow-sky-950/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  {t('landing.openLocalCardTitle', 'Open & Explore Library')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                  Browse study notes, clean tags with Tag Doctor, inspect reading analytics, or selectively share notes with friends.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <span>{t('landing.openLocalCardCta', 'Choose File from Computer')}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* ── GOOGLE DRIVE & SAMPLE DEMO BAR ─────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-slate-100/60 dark:bg-white/[0.02] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Google Drive Cloud Sync</span>
                {isConnected && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                    Connected ✓
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Backup merged files to Drive and pull backups to any device without cables.
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowCloudModal(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/40 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all text-center shadow-sm"
            >
              {isConnected ? t('landing.cloudCardCtaManage', 'Manage Backups') : t('landing.cloudCardCtaConnect', 'Connect Drive')}
            </button>
          </div>
        </div>

        {/* Quick Demo links */}
        <div className="pt-3 flex items-center justify-center space-x-2 text-xs text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>{t('nav.loadSample', 'Try with sample backup')}:</span>
          <button
            type="button"
            onClick={() => handleDemoClick('example')}
            disabled={isLoading}
            className="hover:text-blue-600 dark:hover:text-blue-400 underline font-medium text-[11px]"
          >
            {t('landing.sampleA', 'Sample A')}
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleDemoClick('example2')}
            disabled={isLoading}
            className="hover:text-blue-600 dark:hover:text-blue-400 underline font-medium text-[11px]"
          >
            {t('landing.sampleB', 'Sample B')}
          </button>
        </div>
      </section>

      {/* ── 3 PILLARS OF SIMPLICITY ─────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1.5 shadow-sm">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>100% In-Browser Privacy</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Your study notes and highlights are decrypted and processed strictly in your device's memory.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1.5 shadow-sm">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span>Zero-Loss Deduplication</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Notes on identical verses are unified, tags are merged, and identical highlights are safely combined.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1.5 shadow-sm">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              <span>Universal Compatibility</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Outputs official SHA-256 verified .jwlibrary archives importable into iOS, Android, and Windows.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
