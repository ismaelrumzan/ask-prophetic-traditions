import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

import { getSql, vectorLiteral } from "../src/lib/db";
import { embedQuery } from "../src/lib/embeddings";
import { buildKeywordTsQuery } from "../src/lib/keyword-query";
import { hybridSearchHadiths, searchHadiths } from "../src/lib/retrieval";
import "./load-env";

neonConfig.webSocketConstructor = ws;

const query = "What did the Prophet teach about neighbours?";
const gold = [
  { collection: "muslim", hadithNumber: 79 },
  { collection: "muslim", hadithNumber: 81 },
  { collection: "muslim", hadithNumber: 82 },
];

async function main() {
  const embedding = await embedQuery(query);
  const keyword = buildKeywordTsQuery(query);
  console.log("keyword tsquery:", keyword);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const vec = vectorLiteral(embedding);

  for (const g of gold) {
    const r = await pool.query<{
      in_fts_pool: boolean;
      fts_score: number;
    }>(
      `SELECT
        search_vector @@ to_tsquery('english', $1) AS in_fts_pool,
        ts_rank_cd(search_vector, to_tsquery('english', $1)) AS fts_score
       FROM hadiths WHERE collection=$2 AND hadith_number=$3`,
      [keyword, g.collection, g.hadithNumber],
    );
    const rank = await pool.query<{ rank: string }>(
      `SELECT (COUNT(*) + 1)::text AS rank
       FROM hadiths h
       WHERE ts_rank_cd(h.search_vector, to_tsquery('english', $1)) >
         (SELECT ts_rank_cd(search_vector, to_tsquery('english', $1))
          FROM hadiths WHERE collection = $2 AND hadith_number = $3)`,
      [keyword, g.collection, g.hadithNumber],
    );
    console.log(
      `${g.collection}:${g.hadithNumber} fts_match=${r.rows[0]?.in_fts_pool} fts_rank≈${rank.rows[0]?.rank} score=${Number(r.rows[0]?.fts_score ?? 0).toFixed(4)}`,
    );
  }

  const vectorRank = async (collection: string, hadithNumber: number) => {
    const result = await pool.query<{ rank: string }>(
      `SELECT (COUNT(*) + 1)::text AS rank
       FROM hadiths
       WHERE embedding <=> $1::halfvec < (
         SELECT embedding <=> $1::halfvec FROM hadiths
         WHERE collection = $2 AND hadith_number = $3
       )`,
      [vec, collection, hadithNumber],
    );
    return result.rows[0]?.rank ?? "?";
  };

  for (const g of gold) {
    console.log(`${g.collection}:${g.hadithNumber} vector_rank≈${await vectorRank(g.collection, g.hadithNumber)}`);
  }

  const hybrid50 = await hybridSearchHadiths(query, embedding, 50, 50, 60);
  console.log("\nIn hybrid top-50?");
  for (const g of gold) {
    const idx = hybrid50.findIndex(
      (r) => r.collection === g.collection && r.hadith_number === g.hadithNumber,
    );
    console.log(
      `  ${g.collection}:${g.hadithNumber} ->`,
      idx >= 0
        ? `#${idx + 1} rrf_score=${hybrid50[idx]!.score.toFixed(4)}`
        : "NOT IN POOL",
    );
  }

  if (process.env.VERCEL_OIDC_TOKEN) {
    try {
      const { rows } = await searchHadiths(query, { topK: 8, rerank: true });
      console.log("\nWith rerank top-8:");
      for (const r of rows) {
        console.log(
          `  ${r.collection} #${r.hadith_number} score=${Number(r.score).toFixed(4)}`,
        );
      }
      for (const g of gold) {
        const hit = rows.some(
          (r) =>
            r.collection === g.collection &&
            r.hadith_number === g.hadithNumber,
        );
        console.log(`  gold ${g.collection}:${g.hadithNumber} in top-8? ${hit}`);
      }
    } catch (error) {
      console.log("\nRerank failed:", error instanceof Error ? error.message : error);
    }
  } else {
    console.log("\nSet VERCEL_OIDC_TOKEN to test rerank locally.");
  }

  await pool.end();
}

main();
