import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

import {
  assertEmbeddingProviderReady,
  embedDocuments,
} from "../../src/lib/embeddings";
import "../load-env";

neonConfig.webSocketConstructor = ws;

const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");
const CORPUS_VERSION = "hadith-json-v1.2.0|qwen3-0.6b";
const EMBED_BATCH = Number(process.env.OLLAMA_EMBED_BATCH ?? "32");
const INSERT_BATCH = 32;

type MxChunk = {
  text: string;
  generated_metadata: {
    collection: string;
    hadith_number: number;
    reference_url: string;
    chapter_en?: string;
    chapter_ar?: string;
  };
};

function parseArgs() {
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg?.slice("--only=".length);
  const force = process.argv.includes("--force");
  return { only, force };
}

async function readMxjsonl(filePath: string): Promise<MxChunk[]> {
  const chunks: MxChunk[] = [];
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    chunks.push(JSON.parse(line) as MxChunk);
  }

  return chunks;
}

async function countExisting(collection: string, pool: Pool) {
  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM hadiths WHERE collection = $1",
    [collection],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function clearCollection(collection: string, pool: Pool) {
  await pool.query("DELETE FROM hadiths WHERE collection = $1", [collection]);
}

async function insertBatch(
  pool: Pool,
  rows: Array<{
    collection: string;
    hadithNumber: number;
    searchText: string;
    chapterEn: string;
    chapterAr: string;
    referenceUrl: string;
    embedding: number[];
  }>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `INSERT INTO hadiths (
          collection,
          hadith_number,
          search_text,
          chapter_en,
          chapter_ar,
          reference_url,
          corpus_version,
          embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::halfvec)
        ON CONFLICT (collection, hadith_number) DO UPDATE SET
          search_text = EXCLUDED.search_text,
          chapter_en = EXCLUDED.chapter_en,
          chapter_ar = EXCLUDED.chapter_ar,
          reference_url = EXCLUDED.reference_url,
          corpus_version = EXCLUDED.corpus_version,
          embedding = EXCLUDED.embedding`,
        [
          row.collection,
          row.hadithNumber,
          row.searchText,
          row.chapterEn,
          row.chapterAr,
          row.referenceUrl,
          CORPUS_VERSION,
          `[${row.embedding.join(",")}]`,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadExistingNumbers(collection: string, pool: Pool) {
  const result = await pool.query<{ hadith_number: number }>(
    "SELECT hadith_number FROM hadiths WHERE collection = $1",
    [collection],
  );
  return new Set(result.rows.map((row) => row.hadith_number));
}

async function seedFile(filePath: string, pool: Pool, force: boolean) {
  const slug = path.basename(filePath, ".mxjsonl");
  const chunks = await readMxjsonl(filePath);
  const existingCount = await countExisting(slug, pool);

  if (force && existingCount > 0) {
    console.log(`Clearing ${slug} (${existingCount} rows)…`);
    await clearCollection(slug, pool);
  }

  const existingNumbers =
    force || existingCount === 0
      ? new Set<number>()
      : await loadExistingNumbers(slug, pool);

  const pending = force
    ? chunks
    : chunks.filter(
        (chunk) => !existingNumbers.has(chunk.generated_metadata.hadith_number),
      );

  if (pending.length === 0) {
    console.log(`Skipping ${slug} (complete: ${chunks.length})`);
    return;
  }

  const alreadyDone = chunks.length - pending.length;
  if (alreadyDone > 0) {
    console.log(
      `Resuming ${slug}: ${alreadyDone}/${chunks.length} done, ${pending.length} remaining`,
    );
  } else {
    console.log(`Seeding ${slug}: ${chunks.length} hadiths`);
  }

  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const embeddings = await embedDocuments(batch.map((chunk) => chunk.text));

    const rows = batch.map((chunk, index) => ({
      collection: chunk.generated_metadata.collection,
      hadithNumber: chunk.generated_metadata.hadith_number,
      searchText: chunk.text,
      chapterEn: chunk.generated_metadata.chapter_en ?? "",
      chapterAr: chunk.generated_metadata.chapter_ar ?? "",
      referenceUrl: chunk.generated_metadata.reference_url,
      embedding: embeddings[index] ?? [],
    }));

    for (let j = 0; j < rows.length; j += INSERT_BATCH) {
      await insertBatch(pool, rows.slice(j, j + INSERT_BATCH));
    }

    const done = alreadyDone + Math.min(i + EMBED_BATCH, pending.length);
    console.log(`  ${slug}: ${done}/${chunks.length}`);
  }
}

async function main() {
  const { only, force } = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Link Neon on Vercel and run `vercel env pull .env.local`.",
    );
  }

  console.log(
    `Embedding provider: ${process.env.EMBEDDING_PROVIDER ?? "ollama"}`,
  );
  await assertEmbeddingProviderReady();

  const sql = neon(url);
  await sql`SELECT 1`;

  const files = (await readdir(CORPUS_DIR))
    .filter((name) => name.endsWith(".mxjsonl"))
    .sort();

  const selected = only
    ? files.filter((name) => name.startsWith(`${only}.`))
    : files;

  if (!selected.length) {
    throw new Error(
      only
        ? `No corpus file for --only=${only}. Run npm run build:corpus first.`
        : "No .mxjsonl files in data/corpus. Run npm run build:corpus first.",
    );
  }

  const pool = new Pool({ connectionString: url });
  try {
    for (const file of selected) {
      await seedFile(path.join(CORPUS_DIR, file), pool, force);
    }
  } finally {
    await pool.end();
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
