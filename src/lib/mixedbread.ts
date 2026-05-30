import { Mixedbread } from "@mixedbread/sdk";
import type { ScoredTextInputChunk } from "@mixedbread/sdk/resources/stores/stores";

import { COLLECTION_LABELS, STORE_ID } from "@/lib/constants";
import { AGENTIC_INSTRUCTIONS, QA_INSTRUCTIONS } from "@/lib/instructions";
import type { HadithSource } from "@/lib/types";

export function getMixedbreadClient() {
  const apiKey = process.env.MXBAI_API_KEY;
  if (!apiKey) {
    throw new Error("MXBAI_API_KEY is not configured");
  }
  return new Mixedbread({ apiKey });
}

export function buildQueryFromHistory(
  messages: { role: string; content: string }[],
): string {
  const recent = messages.slice(-6);
  if (recent.length <= 1) {
    return recent.at(-1)?.content ?? "";
  }

  const transcript = recent
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const latest = recent.at(-1)?.content ?? "";
  return `Conversation so far:\n${transcript}\n\nLatest user question:\n${latest}`;
}

type GeneratedMeta = {
  hadith_number?: number;
  reference_url?: string;
  chapter_en?: string;
  chapter_ar?: string;
  collection?: string;
};

export function mapSources(
  sources: Array<ScoredTextInputChunk | unknown> | undefined,
): HadithSource[] {
  if (!sources?.length) return [];

  return sources.map((raw, index) => {
    const chunk = raw as ScoredTextInputChunk & {
      generated_metadata?: GeneratedMeta;
      metadata?: GeneratedMeta & Record<string, unknown>;
    };

    const generated = chunk.generated_metadata ?? {};
    const fileMeta = (chunk.metadata ?? {}) as GeneratedMeta;
    const collection = fileMeta.collection ?? generated.collection;
    const hadithNumber = generated.hadith_number ?? fileMeta.hadith_number;

    return {
      index,
      collection,
      collectionLabel: collection ? COLLECTION_LABELS[collection] : undefined,
      hadithNumber,
      referenceUrl:
        generated.reference_url ??
        (collection && hadithNumber
          ? `https://sunnah.com/${collection}:${hadithNumber}`
          : undefined),
      chapterEn: generated.chapter_en,
      chapterAr: generated.chapter_ar,
      text: chunk.text ?? undefined,
      score: chunk.score,
    };
  });
}

export async function askHadithQuestion(query: string) {
  const client = getMixedbreadClient();
  const agenticEnabled = process.env.AGENTIC_SEARCH !== "false";

  const response = await client.stores.questionAnswering({
    store_identifiers: [STORE_ID],
    query,
    top_k: 8,
    instructions: QA_INSTRUCTIONS,
    qa_options: {
      cite: true,
      multimodal: false,
    },
    search_options: agenticEnabled
      ? {
          agentic: {
            instructions: AGENTIC_INSTRUCTIONS,
          },
          rerank: true,
        }
      : {
          rerank: true,
          rewrite_query: true,
        },
  });

  return {
    answer: response.answer,
    sources: mapSources(response.sources),
  };
}
