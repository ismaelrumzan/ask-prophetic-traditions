import { rerank } from "ai";

import { getSql, vectorLiteral } from "@/lib/db";
import { embedQuery } from "@/lib/embeddings";
import { buildKeywordTsQuery } from "@/lib/keyword-query";
import { getRetrievalConfig } from "@/lib/retrieval-config";

export type HadithRow = {
  collection: string;
  hadith_number: number;
  search_text: string;
  chapter_en: string;
  chapter_ar: string;
  reference_url: string;
  score: number;
};

export type SearchMode = "vector" | "hybrid";

type SearchOptions = {
  topK?: number;
  collection?: string;
  mode?: SearchMode;
  rerank?: boolean;
};

async function hasSearchVectorColumn(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'hadiths'
        AND column_name = 'search_vector'
    ) AS exists
  `;
  return Boolean((rows[0] as { exists?: boolean } | undefined)?.exists);
}

export async function vectorSearchHadiths(
  query: string,
  embedding: number[],
  topK: number,
  collection?: string,
): Promise<HadithRow[]> {
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

export async function hybridSearchHadiths(
  query: string,
  embedding: number[],
  topK: number,
  candidateLimit: number,
  rrfK: number,
  collection?: string,
): Promise<HadithRow[]> {
  const keywordTsQuery = buildKeywordTsQuery(query);
  if (!keywordTsQuery) {
    return vectorSearchHadiths(query, embedding, topK, collection);
  }

  const sql = getSql();
  const vec = vectorLiteral(embedding);

  const rows = collection
    ? await sql`
        WITH vector_candidates AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            embedding <=> ${vec}::halfvec AS distance
          FROM hadiths
          WHERE collection = ${collection}
          ORDER BY embedding <=> ${vec}::halfvec
          LIMIT ${candidateLimit}
        ),
        vector_results AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            ROW_NUMBER() OVER (ORDER BY distance) AS rank
          FROM vector_candidates
        ),
        fts_candidates AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            ts_rank_cd(search_vector, to_tsquery('english', ${keywordTsQuery})) AS fts_score
          FROM hadiths
          WHERE collection = ${collection}
            AND search_vector @@ to_tsquery('english', ${keywordTsQuery})
          ORDER BY fts_score DESC
          LIMIT ${candidateLimit}
        ),
        fts_results AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            ROW_NUMBER() OVER (ORDER BY fts_score DESC) AS rank
          FROM fts_candidates
        ),
        rrf AS (
          SELECT
            COALESCE(v.collection, f.collection) AS collection,
            COALESCE(v.hadith_number, f.hadith_number) AS hadith_number,
            COALESCE(v.search_text, f.search_text) AS search_text,
            COALESCE(v.chapter_en, f.chapter_en) AS chapter_en,
            COALESCE(v.chapter_ar, f.chapter_ar) AS chapter_ar,
            COALESCE(v.reference_url, f.reference_url) AS reference_url,
            COALESCE(1.0 / (${rrfK} + v.rank), 0)
              + COALESCE(1.0 / (${rrfK} + f.rank), 0) AS score
          FROM vector_results v
          FULL OUTER JOIN fts_results f
            ON v.collection = f.collection
           AND v.hadith_number = f.hadith_number
        )
        SELECT
          collection,
          hadith_number,
          search_text,
          chapter_en,
          chapter_ar,
          reference_url,
          score
        FROM rrf
        ORDER BY score DESC
        LIMIT ${topK}
      `
    : await sql`
        WITH vector_candidates AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            embedding <=> ${vec}::halfvec AS distance
          FROM hadiths
          ORDER BY embedding <=> ${vec}::halfvec
          LIMIT ${candidateLimit}
        ),
        vector_results AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            ROW_NUMBER() OVER (ORDER BY distance) AS rank
          FROM vector_candidates
        ),
        fts_candidates AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            ts_rank_cd(search_vector, to_tsquery('english', ${keywordTsQuery})) AS fts_score
          FROM hadiths
          WHERE search_vector @@ to_tsquery('english', ${keywordTsQuery})
          ORDER BY fts_score DESC
          LIMIT ${candidateLimit}
        ),
        fts_results AS (
          SELECT
            collection,
            hadith_number,
            search_text,
            chapter_en,
            chapter_ar,
            reference_url,
            ROW_NUMBER() OVER (ORDER BY fts_score DESC) AS rank
          FROM fts_candidates
        ),
        rrf AS (
          SELECT
            COALESCE(v.collection, f.collection) AS collection,
            COALESCE(v.hadith_number, f.hadith_number) AS hadith_number,
            COALESCE(v.search_text, f.search_text) AS search_text,
            COALESCE(v.chapter_en, f.chapter_en) AS chapter_en,
            COALESCE(v.chapter_ar, f.chapter_ar) AS chapter_ar,
            COALESCE(v.reference_url, f.reference_url) AS reference_url,
            COALESCE(1.0 / (${rrfK} + v.rank), 0)
              + COALESCE(1.0 / (${rrfK} + f.rank), 0) AS score
          FROM vector_results v
          FULL OUTER JOIN fts_results f
            ON v.collection = f.collection
           AND v.hadith_number = f.hadith_number
        )
        SELECT
          collection,
          hadith_number,
          search_text,
          chapter_en,
          chapter_ar,
          reference_url,
          score
        FROM rrf
        ORDER BY score DESC
        LIMIT ${topK}
      `;

  return rows as HadithRow[];
}

async function rerankHadithRows(
  query: string,
  rows: HadithRow[],
  topK: number,
  model: string,
): Promise<HadithRow[]> {
  if (rows.length <= 1) return rows.slice(0, topK);

  const { ranking } = await rerank({
    model,
    query,
    documents: rows.map((row) => row.search_text),
    topN: topK,
  });

  return ranking.map((hit) => {
    const row = rows[hit.originalIndex];
    if (!row) {
      throw new Error(`Rerank returned invalid index ${hit.originalIndex}`);
    }
    return {
      ...row,
      score: hit.score,
    };
  });
}

export async function searchHadiths(
  query: string,
  options: SearchOptions = {},
): Promise<{ rows: HadithRow[]; mode: SearchMode; reranked: boolean }> {
  const config = getRetrievalConfig();
  const topK = options.topK ?? config.finalTopK;
  const mode = options.mode;
  const useRerank = options.rerank ?? config.rerank;
  const recallLimit = useRerank
    ? Math.max(config.candidateLimit, topK * 3)
    : topK;

  const embedding = await embedQuery(query);

  let effectiveMode: SearchMode = "vector";
  let rows: HadithRow[];

  const wantHybrid =
    (mode ?? (config.hybridSearch ? "hybrid" : "vector")) === "hybrid";

  if (wantHybrid && (await hasSearchVectorColumn())) {
    effectiveMode = "hybrid";
    rows = await hybridSearchHadiths(
      query,
      embedding,
      recallLimit,
      config.candidateLimit,
      config.rrfK,
      options.collection,
    );
  } else {
    rows = await vectorSearchHadiths(
      query,
      embedding,
      recallLimit,
      options.collection,
    );
  }

  if (useRerank && rows.length > 0) {
    rows = await rerankHadithRows(query, rows, topK, config.rerankModel);
    return { rows, mode: effectiveMode, reranked: true };
  }

  return { rows: rows.slice(0, topK), mode: effectiveMode, reranked: false };
}
