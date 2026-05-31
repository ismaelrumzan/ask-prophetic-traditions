export const EMBEDDING_DIMENSION = Number(
  process.env.EMBEDDING_DIMENSION ?? "1024",
);

export const GATEWAY_EMBEDDING_MODEL =
  process.env.GATEWAY_EMBEDDING_MODEL ?? "alibaba/qwen3-embedding-0.6b";

export const OLLAMA_EMBEDDING_MODEL =
  process.env.OLLAMA_EMBEDDING_MODEL ?? "qwen3-embedding:0.6b";

/** Qwen3 retrieval instruct — English per model authors; queries only. */
export const QUERY_EMBED_TASK =
  process.env.QUERY_EMBED_TASK ??
  "Given a question about the Prophet's teachings, retrieve relevant hadith passages from the six canonical collections (Kutub al-Sittah) in Arabic and English.";

const DEFAULT_EMBED_MAX_CHARS = Number(
  process.env.EMBED_MAX_CHARS ?? "12000",
);

export function getOllamaBaseUrl() {
  return process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
}

function getEmbeddingProvider() {
  return process.env.EMBEDDING_PROVIDER ?? "ollama";
}

function isContextLengthError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("context length") ||
      error.message.includes("input length exceeds"))
  );
}

/** Qwen3 instruct format — use for user queries only, not corpus documents. */
export function formatQueryForEmbedding(query: string) {
  return `Instruct: ${QUERY_EMBED_TASK}\nQuery:${query.trim()}`;
}

/** Corpus hadith chunks — no instruct prefix per Qwen3 docs. */
export function formatDocumentForEmbedding(text: string) {
  return truncateForEmbedding(text);
}

/** Trim text for embedding only — full hadith text stays in the DB for display. */
export function truncateForEmbedding(
  text: string,
  maxChars = DEFAULT_EMBED_MAX_CHARS,
): string {
  if (text.length <= maxChars) return text;

  const arabicIdx = text.indexOf("Arabic:");
  const englishIdx = text.indexOf("English:");
  if (arabicIdx !== -1 && englishIdx !== -1) {
    const header = text.slice(0, arabicIdx);
    const budget = Math.max(maxChars - header.length - 20, 1000);
    const each = Math.floor(budget / 2);
    const arabicPart = text.slice(arabicIdx, englishIdx).trim().slice(0, each);
    const englishPart = text.slice(englishIdx).trim().slice(0, each);
    return `${header}${arabicPart}\n\n${englishPart}`.slice(0, maxChars);
  }

  return text.slice(0, maxChars);
}

async function embedWithOllama(texts: string[]): Promise<number[][]> {
  const baseUrl = getOllamaBaseUrl();

  const response = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama embed failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { embeddings?: number[][] };
  if (!data.embeddings?.length) {
    throw new Error("Ollama returned no embeddings");
  }

  return data.embeddings;
}

async function embedWithGateway(texts: string[]): Promise<number[][]> {
  const { embedMany } = await import("ai");
  const { gateway } = await import("ai");

  const { embeddings } = await embedMany({
    model: gateway.textEmbeddingModel(GATEWAY_EMBEDDING_MODEL),
    values: texts,
  });

  return embeddings;
}

async function embedBatchSafe(
  texts: string[],
  embedFn: (batch: string[]) => Promise<number[][]>,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    return await embedFn(texts);
  } catch (error) {
    if (!isContextLengthError(error)) throw error;

    if (texts.length === 1) {
      const text = texts[0]!;
      const shorterLimit = Math.max(Math.floor(text.length * 0.5), 2000);
      if (shorterLimit >= text.length - 10) {
        throw error;
      }
      return embedBatchSafe(
        [truncateForEmbedding(text, shorterLimit)],
        embedFn,
      );
    }

    const mid = Math.ceil(texts.length / 2);
    const left = await embedBatchSafe(texts.slice(0, mid), embedFn);
    const right = await embedBatchSafe(texts.slice(mid), embedFn);
    return [...left, ...right];
  }
}

async function embedManyWithProvider(
  texts: string[],
  provider: string,
): Promise<number[][]> {
  const embedFn =
    provider === "gateway" ? embedWithGateway : embedWithOllama;
  return embedBatchSafe(texts, embedFn);
}

export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedManyWithProvider(
    [formatQueryForEmbedding(query)],
    getEmbeddingProvider(),
  );
  if (!embedding) {
    throw new Error("Failed to embed query");
  }
  return embedding;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const prepared = texts.map(formatDocumentForEmbedding);
  return embedManyWithProvider(prepared, getEmbeddingProvider());
}

/** @deprecated Use embedQuery or embedDocuments */
export async function embedText(text: string): Promise<number[]> {
  return embedQuery(text);
}

/** @deprecated Use embedDocuments */
export async function embedManyTexts(texts: string[]): Promise<number[][]> {
  return embedDocuments(texts);
}

export async function assertEmbeddingProviderReady() {
  const provider = getEmbeddingProvider();
  await embedDocuments(["embedding health check document"]);
  await embedQuery("embedding health check query");
  console.log(
    `  provider: ${provider}, model: ${provider === "gateway" ? GATEWAY_EMBEDDING_MODEL : OLLAMA_EMBEDDING_MODEL}`,
  );
}
