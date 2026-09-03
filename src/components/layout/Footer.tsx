import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#070A10] pt-6 pb-28 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3.5">
        {/* Row 1: Privacy note on left, Legal & Author links on right */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{t('footer.clientSide', '100% Client-Side SQLite WASM')}</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-slate-400 dark:text-slate-500">Non-affiliated with jw.org</span>
          </div>

          <div className="flex items-center space-x-3.5 text-xs font-medium">
            <a
              href="/privacy.html"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Privacy
            </a>
            <a
              href="/terms.html"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Terms
            </a>
            <a
              href="https://github.com/Mercu7io/JLib-Sync"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center space-x-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <a
              href="https://redpandaium.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-slate-500 dark:text-slate-400"
            >
              Created by <span className="font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400">redpandaium.com</span>
            </a>
          </div>
        </div>

        {/* Row 2: Subtitle on left, Companion apps aligned with official logos on right */}
        <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <p>
            {t('footer.companion', 'Unofficial study utility for personal research and preservation.')}
          </p>

          <div className="flex items-center space-x-2.5 flex-wrap justify-center sm:justify-end">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Companion apps:</span>

            {/* App 1: Daily Text Wallpaper */}
            <a
              href="https://play.google.com/store/apps/details?id=com.mercutio.dailytextwallpaper"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-slate-200/60 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-200 transition-all font-medium border border-slate-200/80 dark:border-white/[0.08] shadow-sm hover:scale-[1.02]"
            >
              <img
                src="/daily-text.png"
                alt="Daily Text Wallpaper"
                className="w-4 h-4 rounded-md object-cover flex-shrink-0 shadow-sm"
              />
              <span>Daily Text Wallpaper</span>
            </a>

            {/* App 2: Unlock & Learn */}
            <a
              href="https://play.google.com/store/apps/details?id=com.mercutio.unlocklearn"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-slate-200/60 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-200 transition-all font-medium border border-slate-200/80 dark:border-white/[0.08] shadow-sm hover:scale-[1.02]"
            >
              <img
                src="/unlock-learn.png"
                alt="Unlock & Learn"
                className="w-4 h-4 rounded-md object-cover flex-shrink-0 shadow-sm"
              />
              <span>Unlock & Learn</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
