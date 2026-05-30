import { createReadStream } from "node:fs";
import path from "node:path";

import { Mixedbread } from "@mixedbread/sdk";

import "../load-env";

const STORE_NAME = process.env.MXBAI_STORE_ID ?? "kutub-sittah-v1";
const CORPUS_VERSION = "hadith-json-v1.2.0";

const FILES = [
  "bukhari",
  "muslim",
  "abudawud",
  "tirmidhi",
  "nasai",
  "ibnmajah",
] as const;

async function ensureStore(client: Mixedbread) {
  try {
    return await client.stores.retrieve(STORE_NAME);
  } catch {
    console.log(`Creating store ${STORE_NAME}…`);
    return client.stores.create({
      name: STORE_NAME,
      description:
        "Kutub al-Sittah bilingual corpus for Ask Prophetic Traditions",
      is_public: false,
      config: {
        contextualization: {
          with_metadata: ["collection", "corpus_version"],
        },
      },
    });
  }
}

async function main() {
  const apiKey = process.env.MXBAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MXBAI_API_KEY is required. Run `vercel env pull .env.local` or set the key in .env.local.",
    );
  }

  const client = new Mixedbread({ apiKey });
  const store = await ensureStore(client);
  console.log(`Using store: ${store.name} (${store.id})`);

  for (const slug of FILES) {
    const filename = `${slug}.mxjsonl`;
    const filePath = path.join(process.cwd(), "data", "corpus", filename);

    console.log(`Uploading ${filename}…`);
    const result = await client.stores.files.uploadAndPoll({
      storeIdentifier: store.id,
      file: createReadStream(filePath),
      body: {
        external_id: `kutub-sittah/v1/${filename}`,
        metadata: {
          collection: slug,
          corpus_version: CORPUS_VERSION,
        },
      },
    });

    console.log(`  ✓ ${result.filename} — ${result.status}`);
  }

  console.log("Upload complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
