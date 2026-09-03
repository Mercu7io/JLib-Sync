/**
 * Theme Manager for JW Sync
 * Supports 'light', 'dark', and 'system' preferences saved in a 1-year Cookie.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_COOKIE_NAME = 'theme';

/**
 * Reads the theme preference from document.cookie.
 * Defaults to 'system'.
 */
export function getThemePreference(): ThemeMode {
  if (typeof document === 'undefined') return 'system';
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + THEME_COOKIE_NAME + '=([^;]+)'));
  if (match) {
    const val = decodeURIComponent(match[2].trim().toLowerCase());
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val as ThemeMode;
    }
  }
  return 'system';
}

/**
 * Saves the theme preference to document.cookie (1-year duration).
 */
export function setThemePreference(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)};path=/;max-age=31536000;SameSite=Lax`;
  applyTheme(theme);
}

/**
 * Applies the 'dark' class to <html> according to the theme setting or system preference.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  let isDark = false;
  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'light') {
    isDark = false;
  } else {
    // system preference
    isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Listens to system color scheme changes when theme is set to 'system'.
 */
export function initThemeWatcher(onChange?: (isDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent) => {
    const current = getThemePreference();
    if (current === 'system') {
      applyTheme('system');
      onChange?.(e.matches);
    }
  };

  if (media.addEventListener) {
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  } else if ((media as any).addListener) {
    (media as any).addListener(listener);
    return () => (media as any).removeListener(listener);
  }
  return () => {};
}
