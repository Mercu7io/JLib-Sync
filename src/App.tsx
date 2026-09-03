import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { FloatingDock } from './components/layout/FloatingDock';
import { LandingPage } from './pages/LandingPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { StatsPage } from './pages/StatsPage';
import { SharePage } from './pages/SharePage';
import { HelpPage } from './pages/HelpPage';
import { CloudSyncModal } from './components/cloud/CloudSyncModal';
import { useCloudStore } from './store/useCloudStore';
import { applyTheme, getThemePreference, initThemeWatcher } from './lib/theme';

export const App: React.FC = () => {
  const { showCloudModal } = useCloudStore();

  React.useEffect(() => {
    applyTheme(getThemePreference());
    const cleanup = initThemeWatcher();
    return cleanup;
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-slate-100 selection:bg-blue-500/20 selection:text-blue-500 transition-colors duration-150">
        <Navbar />
        <main className="flex-1 pb-16">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/merge" element={<Navigate to="/" replace />} />
            <Route path="/explorer" element={<ExplorerPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/share" element={<SharePage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <FloatingDock />
        <Footer />
        {showCloudModal && <CloudSyncModal />}
      </div>
    </BrowserRouter>
  );
};

export default App;
