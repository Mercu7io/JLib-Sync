import React from 'react';
import { ShieldCheck, HardDrive, Lock, ExternalLink, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleIcon } from '../common/GoogleIcon';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B0F19] py-12 text-slate-600 dark:text-slate-400 text-sm transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Top Grid: Privacy, Tools, Creator, Mission */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Privacy guarantee */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-semibold">
              <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <span>{t('footer.clientSide')}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pr-6">
              {t('footer.companion')}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-500">
              <span className="flex items-center space-x-1">
                <HardDrive className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>In-Memory WASM Processing</span>
              </span>
              <span className="flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{t('footer.zeroTelemetry')}</span>
              </span>
            </div>
          </div>

          {/* Col 2: Navigation & Open Source */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">
              Tools & Features
            </div>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link to="/merge" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Multi-Device Merge
                </Link>
              </li>
              <li>
                <Link to="/explorer" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Study Explorer & Doctor
                </Link>
              </li>
              <li>
                <Link to="/stats" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Study Analytics & Highlights
                </Link>
              </li>
              <li>
                <Link to="/share" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Selective Note Exporter
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/Mercu7io/JLib-Sync"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center space-x-1 font-medium text-slate-800 dark:text-slate-200"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Creator & Mission */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">
              Creator
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Crafted with care by{' '}
              <a
                href="https://redpandaium.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-0.5"
              >
                <span>redpandaium.com</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
              . Useful, privacy-focused utilities for everyday productivity.
            </p>
            <div className="pt-2 text-xs text-slate-500 flex items-center space-x-2">
              <img src="/logo.jpg" alt="Panda JWL-Sync" className="w-4 h-4 rounded object-cover" />
              <span>Panda JWL-Sync • Privacy-First Utility</span>
            </div>
          </div>
        </div>

        {/* Middle Section: Android Companion Apps Showcase */}
        <div className="pt-6 border-t border-slate-200 dark:border-white/[0.08] space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
            <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Discover More Apps by Redpandaium</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* App 1: Daily Text Wallpaper & Widget */}
            <a
              href="https://play.google.com/store/apps/details?id=com.mercutio.dailytextwallpaper"
              target="_blank"
              rel="noreferrer"
              className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all flex items-start space-x-4 shadow-sm hover:shadow"
            >
              <img
                src="https://www.redpandaium.com/testers/img/daily-text.png"
                alt="Daily Text Wallpaper & Widget"
                className="w-12 h-12 rounded-xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex-shrink-0 group-hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Daily Text Wallpaper & Widget
                  </h4>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                    Android
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  A customizable text wallpaper and widget experience. Keep encouraging scriptures close throughout your day.
                </p>
                <div className="pt-1 flex items-center space-x-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  <span>Get on Google Play</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </a>

            {/* App 2: Unlock & Learn */}
            <a
              href="https://play.google.com/store/apps/details?id=com.mercutio.unlocklearn"
              target="_blank"
              rel="noreferrer"
              className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all flex items-start space-x-4 shadow-sm hover:shadow"
            >
              <img
                src="https://www.redpandaium.com/testers/img/unlock-learn.png"
                alt="Unlock & Learn"
                className="w-12 h-12 rounded-xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex-shrink-0 group-hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Unlock & Learn
                  </h4>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                    Android
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  Turn your lock screen into a flashcard study tool. Learn effortlessly every time you unlock your device!
                </p>
                <div className="pt-1 flex items-center space-x-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                  <span>Get on Google Play</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Bottom copyright, GitHub repository badge, and disclaimer */}
        <div className="pt-6 border-t border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="space-y-1">
            <p>Built for privacy-first research and personal library preservation.</p>
            <p className="text-slate-500 dark:text-slate-600 italic">
              Disclaimer: This application has no affiliation, connection, or official link with JW, JW Library, or any other official organization.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-slate-500 whitespace-nowrap flex-wrap gap-2">
            <a
              href="https://github.com/Mercu7io/JLib-Sync"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
            <a href="/terms.html" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Terms
            </a>
            <a href="/privacy.html" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Privacy
            </a>
            <span>• <a href="https://redpandaium.com" target="_blank" rel="noreferrer" className="hover:underline">redpandaium.com</a></span>
          </div>
        </div>
      </div>
    </footer>
  );
};
