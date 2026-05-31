import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

import "../load-env";

neonConfig.webSocketConstructor = ws;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: url });
  try {
    const counts = await pool.query<{ collection: string; count: string }>(
      `SELECT collection, COUNT(*)::text AS count
       FROM hadiths
       GROUP BY collection
       ORDER BY collection`,
    );

    const total = counts.rows.reduce((sum, row) => sum + Number(row.count), 0);

    console.log("Hadith rows by collection:");
    for (const row of counts.rows) {
      console.log(`  ${row.collection}: ${row.count}`);
    }
    console.log(`  total: ${total}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
