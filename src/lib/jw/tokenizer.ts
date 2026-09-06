/**
 * Panda JL Studio — Text Tokenization Engine for UserMark & BlockRange Highlighting
 * Strictly adheres to JW Library highlighting specs:
 * 1. Strip zero-width chars.
 * 2. Split on whitespace.
 * 3. Within chunks, token is maximal run matching [A-Za-zÀ-ɏ’':\-\d]+. Other chars are individual tokens.
 * 4. StartToken and EndToken are 0-indexed and inclusive.
 */

// Zero-width characters regex
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u2060]/g;

// Word run regex
const WORD_RUN_REGEX = /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF’':\-\d]+/;

/**
 * Strips leading paragraph number (e.g., "2 ", "14 ") if present.
 */
export function stripParagraphNumber(text: string): string {
  return text.replace(/^\s*\d+\s+/, '');
}

/**
 * Tokenizes text according to exact JW Library rules.
 */
export function tokenizeText(rawText: string): string[] {
  if (!rawText) return [];

  // 1. Strip zero-width characters
  const clean = rawText.replace(ZERO_WIDTH_REGEX, '');

  // 2. Split on whitespace
  const chunks = clean.split(/\s+/).filter((c) => c.length > 0);
  const tokens: string[] = [];

  // 3. Process each chunk
  for (const chunk of chunks) {
    let cursor = 0;
    while (cursor < chunk.length) {
      const remainder = chunk.slice(cursor);
      const match = remainder.match(WORD_RUN_REGEX);

      if (match && match.index === 0) {
        tokens.push(match[0]);
        cursor += match[0].length;
      } else {
        // Individual character token
        tokens.push(chunk[cursor]);
        cursor += 1;
      }
    }
  }

  return tokens;
}

/**
 * Reassembles a slice of tokens from startToken to endToken (inclusive).
 */
export function sliceTokens(
  tokens: string[],
  startToken: number,
  endToken: number
): string {
  if (!tokens || tokens.length === 0) return '';
  const validStart = Math.max(0, startToken);
  const validEnd = Math.min(tokens.length - 1, endToken);

  if (validStart > validEnd) return '';

  const slice = tokens.slice(validStart, validEnd + 1);
  let result = '';

  for (let i = 0; i < slice.length; i++) {
    const tok = slice[i];
    const isPunct = /^[.,!?;:()""''“”—-]/.test(tok);

    if (i === 0 || isPunct) {
      result += tok;
    } else {
      result += ' ' + tok;
    }
  }

  return result;
}

/**
 * Color scheme for highlights (from AI_CONTEXT.md):
 * 1 = Yellow: direct answer to printed question
 * 2 = Green: principles / scriptures / holy-spirit
 * 3 = Blue: illustrations, definitions, tools
 * 4 = Pink: heart statements / key definitions
 * 5 = Orange: action commands
 * 6 = Purple: warnings
 */
export interface IHighlightColorInfo {
  index: number;
  name: string;
  category: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  hex: string;
}

export const HIGHLIGHT_COLORS: Record<number, IHighlightColorInfo> = {
  1: {
    index: 1,
    name: 'Yellow',
    category: 'Direct Answer',
    bgClass: 'bg-yellow-500/20',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
    hex: '#eab308',
  },
  2: {
    index: 2,
    name: 'Green',
    category: 'Principle / Scripture',
    bgClass: 'bg-emerald-500/20',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    hex: '#10b981',
  },
  3: {
    index: 3,
    name: 'Blue',
    category: 'Illustration / Tool',
    bgClass: 'bg-sky-500/20',
    textClass: 'text-sky-400',
    borderClass: 'border-sky-500/30',
    hex: '#0ea5e9',
  },
  4: {
    index: 4,
    name: 'Pink',
    category: 'Heart Statement',
    bgClass: 'bg-pink-500/20',
    textClass: 'text-pink-400',
    borderClass: 'border-pink-500/30',
    hex: '#ec4899',
  },
  5: {
    index: 5,
    name: 'Orange',
    category: 'Action Command',
    bgClass: 'bg-orange-500/20',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
    hex: '#f97316',
  },
  6: {
    index: 6,
    name: 'Purple',
    category: 'Warning',
    bgClass: 'bg-purple-500/20',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
    hex: '#a855f7',
  },
};
