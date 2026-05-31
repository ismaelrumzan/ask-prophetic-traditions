import { splitAnswerWithCites } from "@/lib/citations";

const EVIDENCE_SECTION_RE = /\nEvidence[\s\S]*$/i;

/** Drop redundant Evidence block when UI renders source cards. */
export function trimAnswerForDisplay(content: string) {
  return content.replace(EVIDENCE_SECTION_RE, "").trim();
}

export function parseAnswerSections(content: string) {
  const trimmed = normalizeSectionText(trimAnswerForDisplay(content));
  const summaryMatch = trimmed.match(
    /^Summary\s*\n([\s\S]*?)(?=^Themes\s*\n|$)/im,
  );
  const themesMatch = trimmed.match(/^Themes\s*\n([\s\S]*?)$/im);

  if (summaryMatch || themesMatch) {
    return {
      summary: normalizeSectionText(summaryMatch?.[1] ?? ""),
      themes: parseThemeBullets(themesMatch?.[1] ?? ""),
      fallback: null as string | null,
    };
  }

  return {
    summary: null,
    themes: [] as string[],
    fallback: normalizeSectionText(trimmed),
  };
}

function normalizeSectionText(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^Summary:?\s*/im, "")
    .replace(/^Themes:?\s*/im, "")
    .trim();
}

function parseThemeBullets(text: string) {
  return normalizeSectionText(text)
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export { splitAnswerWithCites };
