import type { HadithSource } from "@/lib/types";

function extractArabicEnglish(text?: string) {
  if (!text) return { arabic: "", english: "" };

  const arabicMatch = text.match(/Arabic:\s*([\s\S]*?)(?:\n\nEnglish:|$)/i);
  const englishMatch = text.match(/English:\s*([\s\S]*?)$/i);

  return {
    arabic: arabicMatch?.[1]?.trim() ?? "",
    english: englishMatch?.[1]?.trim() ?? text,
  };
}

export function EvidenceCard({
  source,
  citeNumber,
}: {
  source: HadithSource;
  citeNumber: number;
}) {
  const { arabic, english } = extractArabicEnglish(source.text);
  const label =
    source.collectionLabel && source.hadithNumber
      ? `${source.collectionLabel} · ${source.hadithNumber}`
      : `Source ${citeNumber + 1}`;

  return (
    <article className="evidence-card animate-rise" style={{ animationDelay: `${citeNumber * 70}ms` }}>
      <div className="evidence-card__head">
        <span className="evidence-card__index">[{citeNumber + 1}]</span>
        <h3 className="evidence-card__title">{label}</h3>
        {source.referenceUrl ? (
          <a
            className="evidence-card__link"
            href={source.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on sunnah.com
          </a>
        ) : null}
      </div>
      {(source.chapterEn || source.chapterAr) && (
        <p className="evidence-card__chapter">
          {source.chapterEn}
          {source.chapterAr ? ` · ${source.chapterAr}` : ""}
        </p>
      )}
      {arabic ? (
        <p className="evidence-card__arabic" dir="rtl" lang="ar">
          {arabic}
        </p>
      ) : null}
      {english ? <p className="evidence-card__english">{english}</p> : null}
    </article>
  );
}
