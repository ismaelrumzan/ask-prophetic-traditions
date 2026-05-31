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

  const schemaPath = path.join(process.cwd(), "db", "migrate-halfvec.sql");
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

  console.log("Applied db/migrate-halfvec.sql — embeddings now halfvec(1024)");
  console.log("Resume seeding: npm run seed:corpus -- --only=tirmidhi");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
