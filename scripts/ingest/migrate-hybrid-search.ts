import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

import "../load-env";

neonConfig.webSocketConstructor = ws;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Link Neon on Vercel and run `vercel env pull .env.local`.",
    );
  }

  const pool = new Pool({ connectionString: url });

  try {
    const column = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'hadiths'
           AND column_name = 'search_vector'
       ) AS exists`,
    );

    if (column.rows[0]?.exists) {
      console.log("search_vector already exists — nothing to do.");
      return;
    }

    await pool.query(`
      ALTER TABLE hadiths
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS hadiths_search_vector_idx
        ON hadiths
        USING GIN (search_vector)
    `);

    console.log("Added search_vector (GENERATED) + GIN index on hadiths.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
