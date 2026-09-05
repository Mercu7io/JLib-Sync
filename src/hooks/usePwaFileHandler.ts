import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook to handle files opened via PWA File Handling API.
 * When a user double-clicks or "Opens with..." a .jwlibrary file,
 * the OS launches the PWA and passes the file handle to launchQueue.
 */
export const usePwaFileHandler = () => {
  const loadLibrary = useAppStore((s) => s.loadLibrary);

  useEffect(() => {
    if (typeof window === 'undefined' || !('launchQueue' in window)) {
      return;
    }

    try {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files || launchParams.files.length === 0) {
          return;
        }

        for (const fileHandle of launchParams.files) {
          try {
            const file = await fileHandle.getFile();
            if (
              file &&
              (file.name.endsWith('.jwlibrary') ||
                file.name.endsWith('.zip') ||
                file.type.includes('zip'))
            ) {
              await loadLibrary(file);
              break;
            }
          } catch (err) {
            console.warn('[PWA FileHandler] Failed to read launched file:', err);
          }
        }
      });
    } catch (err) {
      console.warn('[PWA FileHandler] launchQueue error:', err);
    }
  }, [loadLibrary]);
};
