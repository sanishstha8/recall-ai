const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Indices of paragraphs that belong to a quoted passage. Chunks are built from whole
 * paragraphs, so matching paragraph prefixes against the quote is robust to the
 * whitespace differences introduced by chunking.
 */
export function paragraphsMatchingQuote(paragraphs: string[], quote: string): Set<number> {
  const q = normalize(quote);
  const matches = new Set<number>();
  if (q.length < 12) return matches;
  const qHead = q.slice(0, 60);
  paragraphs.forEach((p, i) => {
    const np = normalize(p);
    if (np.length < 3) return;
    const pHead = np.slice(0, Math.min(60, np.length));
    if (q.includes(pHead) || np.includes(qHead)) matches.add(i);
  });
  return matches;
}

export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/);
}

export type TextPart = { text: string; match: boolean };

/** Split text into alternating plain/matching parts for safe (non-HTML) highlighting. */
export function splitByQuery(text: string, query: string): TextPart[] {
  const q = query.trim();
  if (q.length < 2) return [{ text, match: false }];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }));
}
