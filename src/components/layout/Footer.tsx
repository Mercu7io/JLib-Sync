import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto border-t border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#070A10] py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          {/* Privacy & Tech Badge */}
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{t('footer.clientSide')}</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-slate-400 dark:text-slate-500">{t('footer.zeroTelemetry')}</span>
          </div>

          {/* Quick Essential Links */}
          <div className="flex items-center space-x-4 text-xs font-medium">
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
            <a
              href="https://redpandaium.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              redpandaium.com
            </a>
          </div>
        </div>

        {/* Disclaimer & Companion Note */}
        <div className="pt-2 border-t border-slate-200/50 dark:border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-left">
          <p>
            {t('footer.companion')}
          </p>
          <div className="flex items-center space-x-2">
            <span>Also on Google Play:</span>
            <a
              href="https://play.google.com/store/apps/details?id=com.mercutio.dailytextwallpaper"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              Daily Text Wallpaper
            </a>
            <span>•</span>
            <a
              href="https://play.google.com/store/apps/details?id=com.mercutio.unlocklearn"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              Unlock & Learn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
