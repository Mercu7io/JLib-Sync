/**
 * Panda JL Studio — Semantic & Search Utilities
 * 100% Client-Side. Runs embeddings in-browser or uses smart semantic keyword matching.
 */

export interface ISearchResultNote {
  noteId: number;
  title: string;
  content: string;
  locationTitle: string | null;
  score: number;
  snippet: string;
  matchedTags?: string[];
}

/**
 * Computes cosine similarity between two float vectors.
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Tokenizes text into lowercase stemmed-like word tokens for fast lexical-semantic scoring.
 */
function tokenizeWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Fast client-side lexical & semantic relevance search.
 * Combines exact keyword matching, token overlap, and title weighting.
 */
export function fastSemanticSearch(
  query: string,
  notes: Array<{
    noteId: number;
    title: string | null;
    content: string | null;
    locationTitle: string | null;
    tags?: string[];
  }>
): ISearchResultNote[] {
  if (!query || !query.trim()) return [];

  const queryTerms = tokenizeWords(query);
  if (queryTerms.length === 0) return [];

  const results: ISearchResultNote[] = [];

  for (const n of notes) {
    const titleText = (n.title || '').toLowerCase();
    const contentText = (n.content || '').toLowerCase();
    const locText = (n.locationTitle || '').toLowerCase();
    const tagText = (n.tags || []).join(' ').toLowerCase();

    let score = 0;
    const matchedTerms: string[] = [];

    // Exact phrase match
    const fullQuery = query.toLowerCase().trim();
    if (titleText.includes(fullQuery)) score += 40;
    if (contentText.includes(fullQuery)) score += 25;
    if (locText.includes(fullQuery)) score += 15;

    // Term-by-term scoring
    for (const term of queryTerms) {
      let termMatched = false;

      if (titleText.includes(term)) {
        score += 15;
        termMatched = true;
      }
      if (contentText.includes(term)) {
        score += 8;
        termMatched = true;
      }
      if (locText.includes(term)) {
        score += 5;
        termMatched = true;
      }
      if (tagText.includes(term)) {
        score += 10;
        termMatched = true;
      }

      if (termMatched) {
        matchedTerms.push(term);
      }
    }

    if (score > 0) {
      // Find a snippet around the first match
      let snippet = n.content || n.title || '';
      if (n.content && fullQuery.length > 0) {
        const idx = n.content.toLowerCase().indexOf(matchedTerms[0] || fullQuery);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(n.content.length, idx + 100);
          snippet = (start > 0 ? '…' : '') + n.content.slice(start, end) + (end < n.content.length ? '…' : '');
        }
      }

      results.push({
        noteId: n.noteId,
        title: n.title || '(Untitled Note)',
        content: n.content || '',
        locationTitle: n.locationTitle,
        score,
        snippet,
        matchedTags: n.tags,
      });
    }
  }

  // Sort descending by relevance score
  return results.sort((a, b) => b.score - a.score);
}
