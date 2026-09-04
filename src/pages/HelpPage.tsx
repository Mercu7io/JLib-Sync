import React from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Smartphone,
  Tablet,
  GitMerge,
  Download,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  HardDrive,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const HelpPage: React.FC = () => {
  const { t } = useTranslation();

  const steps = [
    {
      num: '1',
      icon: Smartphone,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/25',
      title: t('help.step1Title', '1. Export your backups from JW Library'),
      description: t(
        'help.step1Desc',
        'Open JW Library on your phone and tablet. Go to Personal Study > Backup and Restore > Create a Backup, then save the .jwlibrary file.'
      ),
      tips: [
        t('help.step1Tip1', 'Android: Saved in Downloads or Documents folder'),
        t('help.step1Tip2', 'iOS (iPhone/iPad): Save to Files (Files app / On My iPhone)'),
        t('help.step1Tip3', 'Windows: Saved to your chosen folder'),
      ],
    },
    {
      num: '2',
      icon: GitMerge,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/25',
      title: t('help.step2Title', '2. Merge them together on Panda JWL-Sync'),
      description: t(
        'help.step2Desc',
        'Drop your phone backup on the left and your tablet backup on the right. Our algorithm unifies notes on the same verses, consolidates tags, and avoids duplicates.'
      ),
      tips: [
        t('help.step2Tip1', 'Automatic deduplication of highlights & bookmarks'),
        t('help.step2Tip2', 'If identical verses have different notes, choose to keep both'),
        t('help.step2Tip3', 'Tags with the same name are merged cleanly'),
      ],
    },
    {
      num: '3',
      icon: Download,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25',
      title: t('help.step3Title', '3. Restore the merged backup'),
      description: t(
        'help.step3Desc',
        'Download your merged .jwlibrary file. Open JW Library on both devices and select Restore a Backup. Both devices now share your complete research!'
      ),
      tips: [
        t('help.step3Tip1', 'Safe & official: the generated file conforms to JW Library archive specs'),
        t('help.step3Tip2', 'Verified SHA-256 manifest signature for 100% integrity'),
        t('help.step3Tip3', 'Restore on both devices to keep everything synchronized'),
      ],
    },
  ];

  const faqs = [
    {
      q: t('help.faq1Q', 'Will my highlights or tags be lost?'),
      a: t(
        'help.faq1A',
        'No! Unlike the official restore which overwrites the entire database, Panda JWL-Sync combines records intelligently without deleting either side.'
      ),
    },
    {
      q: t('help.faq2Q', 'What happens if I edited the same verse on both devices?'),
      a: t(
        'help.faq2A',
        'The app detects duplicate verse collisions and lets you choose whether to keep both notes or select your preferred version.'
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-semibold backdrop-blur-md">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{t('help.badge', 'User Guide')}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t('help.title', 'User Guide & Help')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {t(
            'help.subtitle',
            'Everything you need to know about merging, exploring, and restoring your study libraries safely.'
          )}
        </p>
      </div>

      {/* ── 3 STEPS CARDS ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-6 sm:p-7 shadow-sm transition-all hover:border-blue-500/30 dark:hover:border-white/[0.15] space-y-4"
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center flex-shrink-0 ${step.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Sub-tips */}
              <div className="pt-2 pl-15 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {step.tips.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-xl px-3 py-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PRIVACY BANNER ──────────────────────────────────────────── */}
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/15 p-6 space-y-3">
        <div className="flex items-center space-x-3 text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <h3 className="text-sm font-bold">{t('help.privacyTitle', '100% In-Browser Privacy Guarantee')}</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {t(
            'help.privacyDesc',
            'Panda JWL-Sync runs completely on your device using WebAssembly SQLite. Your personal notes, highlights, and study tags are never sent to any server.'
          )}
        </p>
        <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
          <span className="flex items-center space-x-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            <span>{t('help.localWasm', 'Local WASM SQLite')}</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>{t('help.zeroUpload', 'Zero server upload')}</span>
          </span>
        </div>
      </div>

      {/* ── FAQ SECTION ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('help.faqTitle', 'Frequently Asked Questions')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-5 space-y-2 shadow-sm"
            >
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <span className="text-blue-500 font-black">{t('help.faqQuestionPrefix', 'Q:')}</span>
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BACK TO MERGE CTA ───────────────────────────────────────── */}
      <div className="pt-4 text-center">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide transition-all shadow-lg shadow-blue-600/30"
        >
          <span>{t('help.startMergingBtn', 'Start Merging Backups')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
