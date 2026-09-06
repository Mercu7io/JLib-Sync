import { en } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { de } from './de.ts';
import { pt } from './pt.ts';
import { it } from './it.ts';
import { ru } from './ru.ts';
import { ja } from './ja.ts';
import { zh_Hans } from './zh-Hans.ts';
import { he } from './he.ts';

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  it: { translation: it },
  ru: { translation: ru },
  ja: { translation: ja },
  'zh-Hans': { translation: zh_Hans },
  he: { translation: he },
};

export type SupportedLocale = keyof typeof resources;
export { en };
export type { TranslationSchema } from './en.ts';
