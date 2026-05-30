import { createReadStream } from "node:fs";
import path from "node:path";

import { Mixedbread } from "@mixedbread/sdk";

import "../load-env";

const STORE_NAME = process.env.MXBAI_STORE_ID ?? "kutub-sittah-v1";
const CORPUS_VERSION = "hadith-json-v1.2.0";

const ALL_BOOKS = [
  "bukhari",
  "muslim",
  "abudawud",
  "tirmidhi",
  "nasai",
  "ibnmajah",
] as const;

type BookSlug = (typeof ALL_BOOKS)[number];

function parseArgs() {
  const args = process.argv.slice(2);
  let only: BookSlug[] | null = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only" && args[i + 1]) {
      only = args[i + 1]!.split(",").map((s) => s.trim()) as BookSlug[];
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }

  const books = only ?? [...ALL_BOOKS];
  for (const book of books) {
    if (!ALL_BOOKS.includes(book)) {
      throw new Error(`Unknown book "${book}". Valid: ${ALL_BOOKS.join(", ")}`);
    }
  }

  return { books, force };
}

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

async function getCompletedExternalIds(
  client: Mixedbread,
  storeId: string,
): Promise<Set<string>> {
  const completed = new Set<string>();
  let after: string | undefined;

  do {
    const page = await client.stores.files.list(storeId, { limit: 100, after });
    for (const file of page.data) {
      if (file.status === "completed" && file.external_id) {
        completed.add(file.external_id);
      }
    }
    after = page.pagination.has_more ? page.pagination.last_cursor ?? undefined : undefined;
  } while (after);

  return completed;
}

async function main() {
  const { books, force } = parseArgs();

  const apiKey = process.env.MXBAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MXBAI_API_KEY is required. Run `vercel env pull .env.local` or set the key in .env.local.",
    );
  }

  const client = new Mixedbread({ apiKey });
  const store = await ensureStore(client);
  console.log(`Using store: ${store.name} (${store.id})`);

  const completed = force ? new Set<string>() : await getCompletedExternalIds(client, store.id);
  if (completed.size > 0 && !force) {
    console.log(`Skipping ${completed.size} already-completed file(s). Use --force to re-upload.`);
  }

  for (const slug of books) {
    const filename = `${slug}.mxjsonl`;
    const externalId = `kutub-sittah/v1/${filename}`;

    if (completed.has(externalId)) {
      console.log(`Skipping ${filename} (already completed)`);
      continue;
    }

    const filePath = path.join(process.cwd(), "data", "corpus", filename);
    console.log(`Uploading ${filename}…`);

    try {
      const result = await client.stores.files.uploadAndPoll({
        storeIdentifier: store.id,
        file: createReadStream(filePath),
        body: {
          external_id: externalId,
          metadata: {
            collection: slug,
            corpus_version: CORPUS_VERSION,
          },
        },
      });

      if (result.status !== "completed") {
        throw new Error(`${filename} ended with status: ${result.status}`);
      }

      console.log(`  ✓ ${result.filename} — ${result.status}`);
    } catch (error) {
      console.error(`  ✗ ${filename} failed`);
      throw error;
    }
  }

  console.log("Upload complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
