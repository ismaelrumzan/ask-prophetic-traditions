const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

/** Parse bilingual chunk text stored in `hadiths.search_text`. */
export function parseSearchText(text?: string) {
  if (!text) {
    return { arabic: "", english: "", narrator: "" };
  }

  const narratorMatch = text.match(/^Narrator:\s*(.+)$/im);
  const arabicMatch = text.match(/Arabic:\s*([\s\S]*?)(?:\n\nEnglish:|$)/i);
  const englishMatch = text.match(/English:\s*([\s\S]*?)$/i);

  const narrator = narratorMatch?.[1]?.trim() ?? "";
  const arabic = arabicMatch?.[1]?.trim() ?? "";
  let english = englishMatch?.[1]?.trim() ?? "";

  english = english.replace(ARABIC_RE, " ").replace(/\s+/g, " ").trim();

  if (!english && !arabic) {
    return { arabic: "", english: text.trim(), narrator };
  }

  if (english && narrator) {
    const narratorKey = narrator.slice(0, 24).toLowerCase();
    if (!english.toLowerCase().includes(narratorKey)) {
      english = `${narrator} ${english}`.trim();
    }
  }

  english = dedupeEnglish(english);

  return { arabic, english, narrator };
}

function dedupeEnglish(english: string) {
  const parts = english
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return english;

  const unique: string[] = [];
  for (const part of parts) {
    const normalized = part.toLowerCase();
    const duplicate = unique.some(
      (existing) =>
        existing.toLowerCase() === normalized ||
        existing.toLowerCase().includes(normalized) ||
        normalized.includes(existing.toLowerCase()),
    );
    if (!duplicate) unique.push(part);
  }

  return unique.join(" ");
}
