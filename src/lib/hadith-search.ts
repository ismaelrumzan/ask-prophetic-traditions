import { generateText } from "ai";

import { getChatModel } from "@/lib/ai";
import { COLLECTION_LABELS } from "@/lib/constants";
import { getSql, vectorLiteral } from "@/lib/db";
import { embedQuery } from "@/lib/embeddings";
import { QA_INSTRUCTIONS } from "@/lib/instructions";
import type { HadithSource } from "@/lib/types";

type HadithRow = {
  collection: string;
  hadith_number: number;
  search_text: string;
  chapter_en: string;
  chapter_ar: string;
  reference_url: string;
  score: number;
};

export async function searchHadiths(
  query: string,
  topK = 8,
  collection?: string,
): Promise<HadithRow[]> {
  const embedding = await embedQuery(query);

  const sql = getSql();
  const vec = vectorLiteral(embedding);

  if (collection) {
    const rows = await sql`
      SELECT
        collection,
        hadith_number,
        search_text,
        chapter_en,
        chapter_ar,
        reference_url,
        1 - (embedding <=> ${vec}::halfvec) AS score
      FROM hadiths
      WHERE collection = ${collection}
      ORDER BY embedding <=> ${vec}::halfvec
      LIMIT ${topK}
    `;
    return rows as HadithRow[];
  }

  const rows = await sql`
    SELECT
      collection,
      hadith_number,
      search_text,
      chapter_en,
      chapter_ar,
      reference_url,
      1 - (embedding <=> ${vec}::halfvec) AS score
    FROM hadiths
    ORDER BY embedding <=> ${vec}::halfvec
    LIMIT ${topK}
  `;
  return rows as HadithRow[];
}

function mapToSources(rows: HadithRow[]): HadithSource[] {
  return rows.map((row, index) => ({
    index,
    collection: row.collection,
    collectionLabel: COLLECTION_LABELS[row.collection],
    hadithNumber: row.hadith_number,
    referenceUrl: row.reference_url,
    chapterEn: row.chapter_en || undefined,
    chapterAr: row.chapter_ar || undefined,
    text: row.search_text,
    score: Number(row.score),
  }));
}

function buildSourceRegistry(sources: HadithSource[]): string {
  return sources
    .map(
      (source) =>
        `[${source.index}] ${source.collectionLabel ?? source.collection} #${source.hadithNumber} (${source.referenceUrl ?? "no url"})`,
    )
    .join("\n");
}

function buildEvidenceContext(sources: HadithSource[]): string {
  return sources
    .map(
      (source, index) =>
        `[Source ${index}] ${source.collectionLabel ?? source.collection} #${source.hadithNumber}\n${source.text}`,
    )
    .join("\n\n");
}

export async function askHadithQuestion(query: string) {
  const rows = await searchHadiths(query);
  const sources = mapToSources(rows);

  if (!sources.length) {
    return {
      answer:
        "I could not find strong matches in the Six Books for this question. Try rephrasing with simpler keywords.",
      sources: [],
    };
  }

  const registry = buildSourceRegistry(sources);

  const { text } = await generateText({
    model: getChatModel(),
    system: QA_INSTRUCTIONS,
    prompt: `SOURCE REGISTRY (only these may be cited — use exact collection # and <cite i="n"/> indices):
${registry}

Retrieved hadith text:
${buildEvidenceContext(sources)}

User question:
${query}`,
  });

  return { answer: text, sources };
}
