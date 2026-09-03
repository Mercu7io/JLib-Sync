import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from '../locales';

export const getInitialLanguage = (): string => {
  try {
    const saved = localStorage.getItem('jwsync_language');
    if (saved && saved in resources) return saved;
  } catch (_) {}
  // Check exact browser language (e.g. zh-Hans)
  const full = navigator.language;
  if (full && full in resources) return full;
  // Check prefix (e.g. fr, es)
  const prefix = full?.split('-')[0];
  if (prefix && prefix in resources) return prefix;
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
