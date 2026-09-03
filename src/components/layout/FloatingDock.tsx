import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GitMerge, BookOpen, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const FloatingDock: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const dockItems = [
    {
      to: '/',
      label: t('nav.merge', 'Merge'),
      icon: GitMerge,
      isActive: location.pathname === '/' || location.pathname === '/merge',
    },
    {
      to: '/explorer',
      label: t('nav.explorer', 'Explorer'),
      icon: BookOpen,
      isActive: location.pathname === '/explorer',
    },
    {
      to: '/stats',
      label: t('nav.analytics', 'Stats'),
      icon: BarChart3,
      isActive: location.pathname === '/stats',
    },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <nav
        aria-label="Bottom Navigation Dock"
        className="flex items-center space-x-1.5 px-3 py-2 rounded-2xl bg-white/85 dark:bg-[#101625]/85 backdrop-blur-xl border border-slate-200/90 dark:border-white/[0.1] shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-black/60 transition-all"
      >
        {dockItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 dark:shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'animate-pulse' : ''}`} />
              <span className="tracking-wide">{item.label}</span>
              {active && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white dark:bg-blue-400" />
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
