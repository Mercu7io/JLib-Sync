/**
 * JW Sync v3 — Language & jw.org Locale Mappings
 * Covers 27 supported languages with strict WTLOCALE codes.
 */

export interface ILanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  wtlocale: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: ILanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', wtlocale: 'E' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', wtlocale: 'S' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', wtlocale: 'T' },
  { code: 'fr', name: 'French', nativeName: 'Français', wtlocale: 'F' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', wtlocale: 'X' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', wtlocale: 'I' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', wtlocale: 'U' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', wtlocale: 'J' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', wtlocale: 'KO' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', wtlocale: 'TG' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', wtlocale: 'Z' },
  { code: 'ceb', name: 'Cebuano', nativeName: 'Cebuano', wtlocale: 'CV' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', wtlocale: 'A', rtl: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', wtlocale: 'Q', rtl: true },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', wtlocale: 'K' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', wtlocale: 'P' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', nativeName: '简体中文', wtlocale: 'CHS' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', nativeName: '繁體中文', wtlocale: 'CH' },
  { code: 'yue-Hant', name: 'Cantonese', nativeName: '粵語', wtlocale: 'CHC' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', wtlocale: 'VT' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', wtlocale: 'H' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', wtlocale: 'HI' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', wtlocale: 'IN' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', wtlocale: 'M' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', wtlocale: 'O' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', wtlocale: 'SW' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', wtlocale: 'G' },
];

export const WTLOCALE_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.wtlocale])
);

export const BIBLE_BOOKS: Record<number, string> = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel', 28: 'Hosea',
  29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah', 33: 'Micah',
  34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai', 38: 'Zechariah',
  39: 'Malachi', 40: 'Matthew', 41: 'Mark', 42: 'Luke', 43: 'John',
  44: 'Acts', 45: 'Romans', 46: '1 Corinthians', 47: '2 Corinthians',
  48: 'Galatians', 49: 'Ephesians', 50: 'Philippians', 51: 'Colossians',
  52: '1 Thessalonians', 53: '2 Thessalonians', 54: '1 Timothy', 55: '2 Timothy',
  56: 'Titus', 57: 'Philemon', 58: 'Hebrews', 59: 'James', 60: '1 Peter',
  61: '2 Peter', 62: '1 John', 63: '2 John', 64: '3 John', 65: 'Jude',
  66: 'Revelation',
};

function pad(num: number, size: number): string {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

export function getJwBibleLink(
  bookNumber: number,
  chapterNumber?: number | null,
  verseNumber?: number | null,
  lang: string = 'en'
): string {
  const wt = WTLOCALE_MAP[lang] || 'E';
  const b = pad(bookNumber, 2);
  const c = chapterNumber ? pad(chapterNumber, 3) : '001';
  const v = verseNumber ? pad(verseNumber, 3) : '000';
  return `https://www.jw.org/finder?wtlocale=${wt}&pub=nwtsty&bible=${b}${c}${v}`;
}

export function getJwPubLink(
  keySymbol: string,
  issueTagNumber?: number,
  docId?: number | null,
  track?: number | null,
  lang: string = 'en'
): string {
  const wt = WTLOCALE_MAP[lang] || 'E';
  let url = `https://www.jw.org/finder?wtlocale=${wt}&pub=${encodeURIComponent(keySymbol)}`;
  if (issueTagNumber && issueTagNumber > 0) {
    url += `&issue=${issueTagNumber}`;
  }
  if (docId) {
    url += `&docid=${docId}`;
  }
  if (track) {
    url += `&track=${track}`;
  }
  return url;
}
