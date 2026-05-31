import { readFileSync } from "node:fs";
import path from "node:path";

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

  const schemaPath = path.join(
    process.cwd(),
    "db",
    "migrate-ollama-embeddings.sql",
  );
  const schema = readFileSync(schemaPath, "utf8");
  const pool = new Pool({ connectionString: url });

  try {
    for (const statement of schema
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await pool.query(statement);
    }
  } finally {
    await pool.end();
  }

  console.log("Applied db/migrate-ollama-embeddings.sql (truncated + 1024-dim vectors)");
  console.log("Re-seed with: npm run seed:corpus -- --force");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
