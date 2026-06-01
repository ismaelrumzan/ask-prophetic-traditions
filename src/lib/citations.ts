const CITE_TAG = /<cite\s+i="(\d+)"\s*\/>/g;

export function extractCitedIndices(content: string) {
  const indices = new Set<number>();
  const regex = new RegExp(CITE_TAG.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    indices.add(Number(match[1]));
  }

  return indices;
}

export function stripCiteTags(text: string) {
  return text.replace(CITE_TAG, "");
}

export function splitAnswerWithCites(text: string) {
  const parts: Array<{ type: "text"; value: string } | { type: "cite"; index: number }> = [];
  let lastIndex = 0;
  const regex = new RegExp(CITE_TAG.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "cite", index: Number(match[1]) });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

export function parseEvidenceSections(text: string) {
  const cleaned = stripCiteTags(text);
  const summaryMatch = cleaned.match(/Summary[:\s]*([\s\S]*?)(?=Themes:|Evidence:|$)/i);
  const themesMatch = cleaned.match(/Themes[:\s]*([\s\S]*?)(?=Evidence:|$)/i);
  const evidenceMatch = cleaned.match(/Evidence[:\s]*([\s\S]*?)$/i);

  if (summaryMatch || themesMatch || evidenceMatch) {
    return {
      summary: summaryMatch?.[1]?.trim(),
      themes: themesMatch?.[1]?.trim(),
      evidence: evidenceMatch?.[1]?.trim(),
      raw: cleaned,
    };
  }

  return { summary: cleaned.trim(), themes: undefined, evidence: undefined, raw: cleaned };
}
