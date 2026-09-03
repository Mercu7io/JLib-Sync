import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { pt } from './pt';
import { de } from './de';
import { it } from './it';
import { ru } from './ru';
import { ja } from './ja';
import { ko } from './ko';
import { zh_Hans } from './zh-Hans';
import { zh_Hant } from './zh-Hant';
import { yue_Hant } from './yue-Hant';
import { tl } from './tl';
import { ceb } from './ceb';
import { ar } from './ar';
import { he } from './he';
import { uk } from './uk';
import { pl } from './pl';
import { vi } from './vi';
import { hu } from './hu';
import { hi } from './hi';
import { id } from './id';
import { ro } from './ro';
import { nl } from './nl';
import { sw } from './sw';
import { el } from './el';
import { sv } from './sv';

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  pt: { translation: pt },
  de: { translation: de },
  it: { translation: it },
  ru: { translation: ru },
  ja: { translation: ja },
  ko: { translation: ko },
  'zh-Hans': { translation: zh_Hans },
  'zh-Hant': { translation: zh_Hant },
  'yue-Hant': { translation: yue_Hant },
  tl: { translation: tl },
  ceb: { translation: ceb },
  ar: { translation: ar },
  he: { translation: he },
  uk: { translation: uk },
  pl: { translation: pl },
  vi: { translation: vi },
  hu: { translation: hu },
  hi: { translation: hi },
  id: { translation: id },
  ro: { translation: ro },
  nl: { translation: nl },
  sw: { translation: sw },
  el: { translation: el },
  sv: { translation: sv },
};

export type SupportedLocale = keyof typeof resources;
export { en };
export type { TranslationSchema } from './en';
