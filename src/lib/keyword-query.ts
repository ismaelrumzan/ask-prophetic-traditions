const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "she",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
  "about",
  "any",
  "can",
  "could",
  "should",
  "would",
  "there",
  "these",
  "those",
  "into",
  "than",
  "then",
  "also",
  "all",
  "not",
  "but",
  "if",
  "so",
  "say",
  "says",
  "said",
  "tell",
  "tells",
  "told",
  "teach",
  "teaches",
  "taught",
  "collection",
  "collections",
]);

const CORPUS_COMMON_TERMS = new Set([
  "prophet",
  "messenger",
  "allah",
  "islam",
  "muslim",
  "believer",
  "believers",
  "faith",
  "deed",
  "deeds",
  "book",
  "chapter",
  "narrated",
  "reported",
  "authority",
  "peace",
  "blessing",
  "blessings",
  "upon",
  "him",
  "apostle",
  "god",
  "lord",
  "prayer",
  "prayers",
  "mosque",
  "mosques",
]);

const TERM_SYNONYMS: Record<string, string[]> = {
  neighbour: ["neighbour", "neighbor"],
  neighbours: ["neighbour", "neighbor"],
  neighbor: ["neighbour", "neighbor"],
  neighbors: ["neighbour", "neighbor"],
  prophet: ["prophet", "messenger"],
  messenger: ["messenger", "prophet"],
};

function expandTerm(term: string): string[] {
  return TERM_SYNONYMS[term] ?? [term];
}

/** OR-based tsquery for hybrid recall — any significant query term can match. */
export function buildKeywordTsQuery(query: string): string | null {
  const words = query.toLowerCase().match(/[a-z']{3,}/g) ?? [];
  const terms = new Set<string>();

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    for (const term of expandTerm(word)) {
      terms.add(term);
    }
  }

  if (terms.size === 0) return null;

  const expanded = [...terms];
  const specific = expanded.filter((term) => !CORPUS_COMMON_TERMS.has(term));
  const chosen = specific.length > 0 ? specific : expanded;

  return chosen.join(" | ");
}
