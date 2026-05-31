import { readFileSync } from "node:fs";
import path from "node:path";

import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

import "../load-env";

neonConfig.webSocketConstructor = ws;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

  const schemaPath = path.join(process.cwd(), "db", "migrate-qwen3.sql");
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

  console.log("Truncated hadiths for Qwen3 re-embed.");
  console.log("");
  console.log("Next:");
  console.log("  ollama pull qwen3-embedding:0.6b");
  console.log("  npm run seed:corpus");
  console.log("");
  console.log("Production (Vercel): set EMBEDDING_PROVIDER=gateway and re-seed locally,");
  console.log("  or host Ollama with the same model for query embeddings.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
