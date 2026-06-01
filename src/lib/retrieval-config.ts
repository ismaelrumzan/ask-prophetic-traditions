export type RetrievalConfig = {
  hybridSearch: boolean;
  rrfK: number;
  candidateLimit: number;
  rerank: boolean;
  rerankModel: string;
  finalTopK: number;
};

function readBool(name: string, defaultValue: boolean) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readInt(name: string, defaultValue: number) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

export function getRetrievalConfig(): RetrievalConfig {
  const finalTopK = readInt("RETRIEVAL_TOP_K", 8);

  return {
    hybridSearch: readBool("HYBRID_SEARCH", true),
    rrfK: readInt("HYBRID_RRF_K", 60),
    candidateLimit: readInt("HYBRID_CANDIDATE_LIMIT", 50),
    rerank: readBool("RETRIEVAL_RERANK", false),
    rerankModel: process.env.RERANK_MODEL ?? "cohere/rerank-v3.5",
    finalTopK,
  };
}
