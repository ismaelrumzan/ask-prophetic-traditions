import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

import { COLLECTION_LABELS } from "../src/lib/constants";
import {
  embedDocuments,
  embedQuery,
  GATEWAY_EMBEDDING_MODEL,
  getOllamaBaseUrl,
  OLLAMA_EMBEDDING_MODEL,
} from "../src/lib/embeddings";
import { getRetrievalConfig } from "../src/lib/retrieval-config";
import {
  hybridSearchHadiths,
  searchHadiths,
  vectorSearchHadiths,
  type HadithRow,
  type SearchMode,
} from "../src/lib/retrieval";
import { parseSearchText } from "../src/lib/hadith-text";
import "./load-env";

neonConfig.webSocketConstructor = ws;

type GoldRef = { collection: string; hadithNumber: number; label?: string };

type EvalCase = {
  id: string;
  query: string;
  gold: GoldRef[];
};

const EVAL_CASES: EvalCase[] = [
  {
    id: "neighbours",
    query: "What did the Prophet teach about neighbours?",
    gold: [
      { collection: "muslim", hadithNumber: 79, label: "Paradise / neighbour safe" },
      { collection: "muslim", hadithNumber: 81, label: "Do not harm neighbour" },
      { collection: "muslim", hadithNumber: 82, label: "Do good to neighbour" },
      { collection: "abudawud", hadithNumber: 3518, label: "Neighbour's claim to land" },
    ],
  },
  {
    id: "intentions",
    query: "What is the reward of intentions in deeds?",
    gold: [
      { collection: "muslim", hadithNumber: 244, label: "Intentions recorded" },
      { collection: "bukhari", hadithNumber: 1, label: "Actions by intentions" },
    ],
  },
  {
    id: "sincerity",
    query: "What do the collections say about sincerity in deeds?",
    gold: [
      { collection: "muslim", hadithNumber: 244 },
      { collection: "muslim", hadithNumber: 6476, label: "Truthfulness" },
    ],
  },
];

function parseArgs() {
  const queryArg = process.argv.find((a) => a.startsWith("--query="));
  const caseArg = process.argv.find((a) => a.startsWith("--case="));
  const topArg = process.argv.find((a) => a.startsWith("--top="));
  const goldArg = process.argv.find((a) => a.startsWith("--gold="));
  const modeArg = process.argv.find((a) => a.startsWith("--mode="));

  return {
    query: queryArg?.slice("--query=".length),
    caseId: caseArg?.slice("--case=".length),
    topK: Number(topArg?.slice("--top=".length) ?? "20"),
    goldRaw: goldArg?.slice("--gold=".length),
    mode: modeArg?.slice("--mode=".length) as SearchMode | "both" | undefined,
    listCases: process.argv.includes("--list"),
    allCases: process.argv.includes("--all"),
    compare: process.argv.includes("--compare"),
  };
}

function parseGold(raw: string): GoldRef[] {
  return raw.split(",").map((part) => {
    const [collection, num] = part.trim().split(":");
    return { collection, hadithNumber: Number(num) };
  });
}

function snippet(text: string, max = 120) {
  const { english } = parseSearchText(text);
  const line = english || text.replace(/\s+/g, " ");
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

async function printConfig(pool: Pool) {
  const provider = process.env.EMBEDDING_PROVIDER ?? "ollama";
  const retrieval = getRetrievalConfig();
  console.log("=== Config ===");
  console.log(`EMBEDDING_PROVIDER: ${provider}`);
  if (provider === "gateway") {
    console.log(`GATEWAY_EMBEDDING_MODEL: ${GATEWAY_EMBEDDING_MODEL}`);
  } else {
    console.log(`OLLAMA_BASE_URL: ${getOllamaBaseUrl()}`);
    console.log(`OLLAMA_EMBEDDING_MODEL: ${OLLAMA_EMBEDDING_MODEL}`);
  }
  if (provider === "ollama" && process.env.GATEWAY_EMBEDDING_MODEL) {
    console.log(
      "Note: GATEWAY_EMBEDDING_MODEL is ignored when EMBEDDING_PROVIDER=ollama",
    );
  }

  const hybridColumn = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'hadiths' AND column_name = 'search_vector'
     ) AS exists`,
  );

  console.log(`HYBRID_SEARCH: ${retrieval.hybridSearch}`);
  console.log(`search_vector column: ${hybridColumn.rows[0]?.exists ? "yes" : "no (run npm run db:migrate:hybrid)"}`);
  console.log(`HYBRID_CANDIDATE_LIMIT: ${retrieval.candidateLimit}`);
  console.log(`RETRIEVAL_RERANK: ${retrieval.rerank}`);
  if (retrieval.rerank) {
    console.log(`RERANK_MODEL: ${retrieval.rerankModel}`);
  }

  const count = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM hadiths",
  );
  const version = await pool.query<{ corpus_version: string }>(
    "SELECT corpus_version FROM hadiths LIMIT 1",
  );
  const neighbourCount = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM hadiths
     WHERE search_text ILIKE '%neighbour%' OR search_text ILIKE '%neighbor%'`,
  );
  console.log(`Rows in hadiths: ${count.rows[0]?.count ?? "0"}`);
  console.log(`Sample corpus_version: ${version.rows[0]?.corpus_version ?? "n/a"}`);
  console.log(`Rows mentioning neighbour/neighbor: ${neighbourCount.rows[0]?.count ?? "0"}`);
  console.log("");
}

async function fetchResults(
  query: string,
  topK: number,
  mode: SearchMode,
): Promise<HadithRow[]> {
  const config = getRetrievalConfig();
  const embedding = await embedQuery(query);

  if (mode === "hybrid") {
    return hybridSearchHadiths(
      query,
      embedding,
      topK,
      config.candidateLimit,
      config.rrfK,
    );
  }

  return vectorSearchHadiths(query, embedding, topK);
}

function printResults(
  label: string,
  results: HadithRow[],
  gold: GoldRef[],
  topK: number,
) {
  console.log(`=== ${label} (top ${topK}) ===`);
  results.forEach((row, index) => {
    const book = COLLECTION_LABELS[row.collection] ?? row.collection;
    const goldHit = gold.some(
      (g) => g.collection === row.collection && g.hadithNumber === row.hadith_number,
    );
    const marker = goldHit ? " ★ GOLD" : "";
    console.log(
      `  ${index + 1}. ${book} #${row.hadith_number}  score=${Number(row.score).toFixed(4)}${marker}`,
    );
    console.log(`     ${snippet(row.search_text)}`);
  });

  const retrievedGold = gold.filter((g) =>
    results.some(
      (r) => r.collection === g.collection && r.hadith_number === g.hadithNumber,
    ),
  );

  console.log("");
  console.log(
    `Gold in top-${topK}: ${retrievedGold.length}/${gold.length}`,
  );
  if (retrievedGold.length < gold.length) {
    console.log(
      "Missing:",
      gold
        .filter((g) => !retrievedGold.includes(g))
        .map((g) => `${g.collection}:${g.hadithNumber}`)
        .join(", "),
    );
  }
  console.log("");
}

async function scoreGoldRefs(
  query: string,
  gold: GoldRef[],
  pool: Pool,
) {
  const embedding = await embedQuery(query);
  const vec = `[${embedding.join(",")}]`;
  const sql = (await import("../src/lib/db")).getSql();

  console.log("=== Gold references (vector similarity) ===");

  for (const ref of gold) {
    const row = await sql`
      SELECT
        collection,
        hadith_number,
        search_text,
        1 - (embedding <=> ${vec}::halfvec) AS score
      FROM hadiths
      WHERE collection = ${ref.collection}
        AND hadith_number = ${ref.hadithNumber}
    `;

    const hit = row[0] as
      | {
          collection: string;
          hadith_number: number;
          search_text: string;
          score: number;
        }
      | undefined;

    const label = COLLECTION_LABELS[ref.collection] ?? ref.collection;
    if (!hit) {
      console.log(`  MISSING IN DB: ${ref.collection}:${ref.hadithNumber} ${ref.label ?? ""}`);
      continue;
    }

    const rankResult = await pool.query<{ rank: string }>(
      `SELECT (COUNT(*) + 1)::text AS rank
       FROM hadiths
       WHERE embedding <=> $1::halfvec < (
         SELECT embedding <=> $1::halfvec FROM hadiths
         WHERE collection = $2 AND hadith_number = $3
       )`,
      [vec, ref.collection, ref.hadithNumber],
    );

    const rank = rankResult.rows[0]?.rank ?? "?";
    console.log(
      `  ${label} #${ref.hadithNumber}  score=${Number(hit.score).toFixed(4)}  rank≈${rank}  ${ref.label ?? ""}`,
    );
    console.log(`    ${snippet(hit.search_text, 100)}`);
  }
  console.log("");
}

async function runEvalCase(
  evalCase: EvalCase,
  topK: number,
  pool: Pool,
  mode: SearchMode | "both",
  compare: boolean,
) {
  console.log(`=== Query: ${evalCase.id} ===`);
  console.log(`"${evalCase.query}"\n`);

  if (compare || mode === "both") {
    const vectorResults = await fetchResults(evalCase.query, topK, "vector");
    printResults("Vector-only", vectorResults, evalCase.gold, topK);

    const hybridResults = await fetchResults(evalCase.query, topK, "hybrid");
    printResults("Hybrid (RRF)", hybridResults, evalCase.gold, topK);

    const appResults = await searchHadiths(evalCase.query, { topK });
    printResults(
      `App pipeline (${appResults.mode}${appResults.reranked ? " + rerank" : ""})`,
      appResults.rows,
      evalCase.gold,
      topK,
    );
  } else {
    const effectiveMode = mode ?? (getRetrievalConfig().hybridSearch ? "hybrid" : "vector");
    const results = await fetchResults(evalCase.query, topK, effectiveMode);
    printResults(
      effectiveMode === "hybrid" ? "Hybrid (RRF)" : "Vector-only",
      results,
      evalCase.gold,
      topK,
    );
  }

  await scoreGoldRefs(evalCase.query, evalCase.gold, pool);

  const sample = evalCase.gold[0];
  if (sample) {
    const row = await pool.query<{ search_text: string }>(
      "SELECT search_text FROM hadiths WHERE collection = $1 AND hadith_number = $2",
      [sample.collection, sample.hadithNumber],
    );
    const text = row.rows[0]?.search_text;
    if (text) {
      const [freshDoc] = await embedDocuments([text]);
      const queryVec = await embedQuery(evalCase.query);
      if (freshDoc && queryVec.length === freshDoc.length) {
        let dot = 0;
        let qNorm = 0;
        let dNorm = 0;
        for (let i = 0; i < queryVec.length; i++) {
          dot += queryVec[i]! * freshDoc[i]!;
          qNorm += queryVec[i]! ** 2;
          dNorm += freshDoc[i]! ** 2;
        }
        const freshCosine = dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
        console.log(
          `=== Live check (${sample.collection}:${sample.hadithNumber}) ===`,
        );
        console.log(
          `  Fresh doc embed vs query cosine: ${freshCosine.toFixed(4)}`,
        );
        console.log(
          "  (If gold rank is low but fresh cosine is high, DB vectors may be stale/wrong model.)",
        );
        console.log("");
      }
    }
  }
}

async function main() {
  const { query, caseId, topK, goldRaw, mode, listCases, allCases, compare } =
    parseArgs();

  if (listCases) {
    console.log("Eval cases:");
    for (const c of EVAL_CASES) {
      console.log(`  --case=${c.id}  "${c.query}"`);
    }
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: url });
  try {
    await printConfig(pool);

    if (allCases) {
      for (const evalCase of EVAL_CASES) {
        await runEvalCase(
          evalCase,
          topK,
          pool,
          mode ?? "both",
          compare || !mode,
        );
      }
      return;
    }

    let evalCase: EvalCase | undefined;
    if (caseId) {
      evalCase = EVAL_CASES.find((c) => c.id === caseId);
      if (!evalCase) {
        throw new Error(`Unknown --case=${caseId}. Use --list`);
      }
    } else if (query) {
      evalCase = {
        id: "custom",
        query,
        gold: goldRaw ? parseGold(goldRaw) : [],
      };
    } else {
      evalCase = EVAL_CASES[0];
    }

    await runEvalCase(
      evalCase,
      topK,
      pool,
      mode ?? "both",
      compare || !mode,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
