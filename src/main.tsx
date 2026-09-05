import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import './i18n';
import App from './App';

// Auto-register service worker for offline support and updates
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // When new version is detected, immediately skip waiting and reload clients
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] Ready for offline use');
  },
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      // Check for updates every 15 minutes
      setInterval(() => {
        registration.update().catch(() => {});
      }, 15 * 60 * 1000);
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
