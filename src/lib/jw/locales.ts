/**
 * Panda JL Studio — Language & Locale Mappings
 * Supported 10 main languages including English, French, and Hebrew.
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
  { code: 'fr', name: 'French', nativeName: 'Français', wtlocale: 'F' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', wtlocale: 'X' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', wtlocale: 'T' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', wtlocale: 'I' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', wtlocale: 'U' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', wtlocale: 'J' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', nativeName: '简体中文', wtlocale: 'CHS' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', wtlocale: 'Q', rtl: true },
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
