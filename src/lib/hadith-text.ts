const ARABIC_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

const BIDI_MARKS_RE = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g;

/** Parse bilingual chunk text stored in `hadiths.search_text`. */
export function parseSearchText(text?: string) {
  if (!text) {
    return { arabic: "", english: "", narrator: "" };
  }

  const narratorMatch = text.match(/^Narrator:\s*(.+)$/im);
  const narrator = narratorMatch?.[1]?.trim() ?? "";

  const englishParts = text.split(/\nEnglish:\s*/i);
  const beforeEnglish = englishParts[0] ?? text;
  let english =
    englishParts.length >= 2 ? englishParts.slice(1).join("\nEnglish: ").trim() : "";

  const arabicMatch = beforeEnglish.match(/Arabic:\s*([\s\S]*)$/i);
  const arabic = arabicMatch?.[1]?.trim() ?? "";

  english = cleanEnglish(english);

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

function cleanEnglish(english: string) {
  return english
    .replace(ARABIC_RE, " ")
    .replace(BIDI_MARKS_RE, "")
    .replace(/\uFDFA/g, "")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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
