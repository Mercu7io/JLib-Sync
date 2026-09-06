/**
 * Theme Manager for Panda JL Studio
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

/**
 * Text Size Manager
 * Supports 5 progressive scaling levels:
 * Level 1: 14px (Compact)
 * Level 2: 15.5px (Normal)
 * Level 3: 17.5px (Large — Default)
 * Level 4: 19.5px (Extra Large)
 * Level 5: 21.5px (Huge / Accessibility)
 */
export type TextSizeLevel = 1 | 2 | 3 | 4 | 5;
export type TextSizeMode = TextSizeLevel | 'small' | 'normal' | 'large' | 'xlarge' | 'xxlarge';

const TEXT_SIZE_COOKIE_NAME = 'text_size';

export function normalizeTextSize(val: unknown): TextSizeLevel {
  if (val === 1 || val === '1' || val === 'small') return 1;
  if (val === 2 || val === '2' || val === 'normal') return 2;
  if (val === 3 || val === '3' || val === 'large') return 3;
  if (val === 4 || val === '4' || val === 'xlarge') return 4;
  if (val === 5 || val === '5' || val === 'xxlarge') return 5;
  const num = parseInt(String(val), 10);
  if (num >= 1 && num <= 5) return num as TextSizeLevel;
  return 3; // Default is 3 (Large)
}

/**
 * Reads the text size preference from cookie or localStorage.
 * Defaults to 3 (Large).
 */
export function getTextSizePreference(): TextSizeLevel {
  if (typeof document === 'undefined') return 3;
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + TEXT_SIZE_COOKIE_NAME + '=([^;]+)'));
    if (match) {
      return normalizeTextSize(decodeURIComponent(match[2].trim().toLowerCase()));
    }
    const saved = localStorage.getItem('jlib_text_size') || localStorage.getItem('jwsync_text_size');
    if (saved) {
      return normalizeTextSize(saved);
    }
  } catch (_) {}
  return 3;
}

/**
 * Saves the text size preference to cookie and localStorage, and applies it to <html>.
 */
export function setTextSizePreference(size: TextSizeMode): void {
  if (typeof document === 'undefined') return;
  const level = normalizeTextSize(size);
  try {
    document.cookie = `${TEXT_SIZE_COOKIE_NAME}=${level};path=/;max-age=31536000;SameSite=Lax`;
    localStorage.setItem('jlib_text_size', String(level));
  } catch (_) {}
  applyTextSize(level);
}

/**
 * Applies the 'data-text-size' attribute to <html>.
 */
export function applyTextSize(size: TextSizeMode): void {
  if (typeof document === 'undefined') return;
  const level = normalizeTextSize(size);
  document.documentElement.setAttribute('data-text-size', String(level));
}

