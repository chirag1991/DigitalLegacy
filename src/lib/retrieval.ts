/**
 * Lightweight BM25 keyword retrieval over a person's memories.
 *
 * No embeddings or vector database are needed for an MVP: a single person's
 * legacy is usually a few hundred memories at most, and BM25 with light
 * stemming finds the relevant stories well. Swap this out for embeddings later
 * if the memory bank grows large.
 */

export interface RetrievalDoc {
  id: string;
  text: string;
  /** Optional boost applied to the final score (e.g. distilled memories > raw answers). */
  weight?: number;
}

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by did do does for from had has have he her hers him his how i if in into is it its " +
    "me my of on or our she so than that the their them then there they this to too us was we were what when where " +
    "which who whom why will with would you your yours about just can could should tell told say said really very " +
    "like also some any all one get got"
  ).split(" "),
);

/** Very small suffix stemmer — good enough to match "cooking" with "cooked" and "cook". */
export function stem(word: string): string {
  let w = word;
  for (const suffix of ["ingly", "edly", "ing", "ies", "ied", "ed", "es", "ly", "s"]) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      if (suffix === "ies" || suffix === "ied") w += "y";
      break;
    }
  }
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export function rankDocuments(
  query: string,
  docs: RetrievalDoc[],
  limit = 8,
  k1 = 1.4,
  b = 0.75,
): { doc: RetrievalDoc; score: number }[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || docs.length === 0) return [];

  const tokenized = docs.map((d) => tokenize(d.text));
  const avgLen = tokenized.reduce((s, t) => s + t.length, 0) / tokenized.length || 1;

  const docFreq = new Map<string, number>();
  for (const terms of tokenized) {
    for (const term of new Set(terms)) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }

  const N = docs.length;
  const scored = docs.map((doc, i) => {
    const terms = tokenized[i];
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const q of queryTerms) {
      const f = tf.get(q);
      if (!f) continue;
      const df = docFreq.get(q) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * terms.length) / avgLen)));
    }
    return { doc, score: score * (doc.weight ?? 1) };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, limit);
}
