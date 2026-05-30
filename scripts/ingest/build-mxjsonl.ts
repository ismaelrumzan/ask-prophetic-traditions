import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const CORPUS_VERSION = "hadith-json-v1.2.0";
const BASE_URL = `https://raw.githubusercontent.com/AhmedBaset/hadith-json/${CORPUS_VERSION}/db/by_book/the_9_books`;

const BOOKS = [
  { slug: "bukhari", file: "bukhari.json", title: "Sahih al-Bukhari" },
  { slug: "muslim", file: "muslim.json", title: "Sahih Muslim" },
  { slug: "abudawud", file: "abudawud.json", title: "Sunan Abi Dawud" },
  { slug: "tirmidhi", file: "tirmidhi.json", title: "Jami' at-Tirmidhi" },
  { slug: "nasai", file: "nasai.json", title: "Sunan an-Nasa'i" },
  { slug: "ibnmajah", file: "ibnmajah.json", title: "Sunan Ibn Majah" },
] as const;

type HadithJsonBook = {
  chapters?: Array<{ id: number; arabic?: string; english?: string }>;
  hadiths: Array<{
    idInBook: number;
    chapterId: number;
    arabic: string;
    english: { narrator: string; text: string };
  }>;
};

type MxChunk = {
  type: "text";
  chunk_index: number;
  text: string;
  mime_type: string;
  generated_metadata: Record<string, string | number>;
};

function buildChunkText(
  bookTitle: string,
  hadithNumber: number,
  chapterEn: string,
  chapterAr: string,
  narrator: string,
  arabic: string,
  english: string,
) {
  return [
    `Collection: ${bookTitle} (#${hadithNumber})`,
    chapterEn ? `Chapter: ${chapterEn}${chapterAr ? ` / ${chapterAr}` : ""}` : "",
    narrator ? `Narrator: ${narrator.replace(/^Narrated\s+/i, "").replace(/:$/, "")}` : "",
    "",
    "Arabic:",
    arabic.trim(),
    "",
    "English:",
    english.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

async function downloadJson(file: string): Promise<HadithJsonBook> {
  const res = await fetch(`${BASE_URL}/${file}`);
  if (!res.ok) {
    throw new Error(`Failed to download ${file}: ${res.status}`);
  }
  return res.json() as Promise<HadithJsonBook>;
}

async function writeMxjsonl(slug: string, book: HadithJsonBook, title: string) {
  const outDir = path.join(process.cwd(), "data", "corpus");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.mxjsonl`);

  const chapterMap = new Map<number, { en: string; ar: string }>();
  for (const chapter of book.chapters ?? []) {
    chapterMap.set(chapter.id, {
      en: chapter.english ?? "",
      ar: chapter.arabic ?? "",
    });
  }

  const lines: string[] = [];

  for (const hadith of book.hadiths) {
    const chapter = chapterMap.get(hadith.chapterId);
    const narrator = hadith.english.narrator ?? "";
    const english = `${narrator} ${hadith.english.text}`.trim();
    const hadithNumber = hadith.idInBook;

    const chunk: MxChunk = {
      type: "text",
      chunk_index: hadithNumber,
      text: buildChunkText(
        title,
        hadithNumber,
        chapter?.en ?? "",
        chapter?.ar ?? "",
        narrator,
        hadith.arabic,
        english,
      ),
      mime_type: "text/plain",
      generated_metadata: {
        type: "text",
        file_type: "text/plain",
        language: "multilingual",
        hadith_number: hadithNumber,
        reference_url: `https://sunnah.com/${slug}:${hadithNumber}`,
        chapter_en: chapter?.en ?? "",
        chapter_ar: chapter?.ar ?? "",
        collection: slug,
      },
    };

    lines.push(JSON.stringify(chunk));
  }

  await pipeline(Readable.from(lines.join("\n") + "\n"), createWriteStream(outPath));
  console.log(`Wrote ${lines.length} chunks → ${outPath}`);
}

async function main() {
  for (const book of BOOKS) {
    console.log(`Processing ${book.title}…`);
    const json = await downloadJson(book.file);
    await writeMxjsonl(book.slug, json, book.title);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
