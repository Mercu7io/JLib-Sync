/**
 * PWA Update and Cache Clearing Utilities
 * Handles force update and service worker registration updates.
 */

export const forceAppUpdate = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      // Clean all dynamic runtime and asset caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    }
  } catch (err) {
    console.warn('[PWA] Cache purge warning:', err);
  } finally {
    // Hard reload bypassing cache
    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
  }
};
