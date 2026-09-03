import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { MergePage } from './pages/MergePage';
import { ExplorerPage } from './pages/ExplorerPage';
import { StatsPage } from './pages/StatsPage';
import { SharePage } from './pages/SharePage';
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
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 selection:bg-orange-500/20 selection:text-orange-400 transition-colors duration-150">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/merge" element={<MergePage />} />
            <Route path="/explorer" element={<ExplorerPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/share" element={<SharePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        {showCloudModal && <CloudSyncModal />}
      </div>
    </BrowserRouter>
  );
};

export default App;
