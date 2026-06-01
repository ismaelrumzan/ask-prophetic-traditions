import { EvidenceCard } from "@/components/evidence-card";
import { extractCitedIndices } from "@/lib/citations";
import { parseSearchText } from "@/lib/hadith-text";
import type { HadithSource } from "@/lib/types";

function sourceLabel(source: HadithSource, citeNumber: number) {
  if (source.collectionLabel && source.hadithNumber) {
    return `${source.collectionLabel} · ${source.hadithNumber}`;
  }
  return `Source ${citeNumber + 1}`;
}

function SupportingEvidenceRow({
  source,
  citeNumber,
}: {
  source: HadithSource;
  citeNumber: number;
}) {
  const { english } = parseSearchText(source.text);
  const snippet =
    english.length > 140 ? `${english.slice(0, 140).trim()}…` : english;

  return (
    <article className="evidence-support__item">
      <div className="evidence-support__head">
        <span className="evidence-support__index">[{citeNumber + 1}]</span>
        <h4 className="evidence-support__title">{sourceLabel(source, citeNumber)}</h4>
        {source.referenceUrl ? (
          <a
            className="evidence-support__link"
            href={source.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            sunnah.com
          </a>
        ) : null}
      </div>
      {snippet ? <p className="evidence-support__snippet">{snippet}</p> : null}
    </article>
  );
}

export function EvidenceStack({
  content,
  sources,
}: {
  content: string;
  sources: HadithSource[];
}) {
  const citedIndices = extractCitedIndices(content);
  const hasExplicitCites = citedIndices.size > 0;

  const cited = hasExplicitCites
    ? sources.filter((source) => citedIndices.has(source.index))
    : sources;
  const supporting = hasExplicitCites
    ? sources.filter((source) => !citedIndices.has(source.index))
    : [];

  return (
    <div className="evidence-stack">
      <p className="evidence-stack__label">Evidence</p>

      {cited.map((source) => (
        <EvidenceCard key={source.index} source={source} citeNumber={source.index} />
      ))}

      {supporting.length ? (
        <details className="evidence-support">
          <summary className="evidence-support__summary">
            Supporting references ({supporting.length})
          </summary>
          <p className="evidence-support__hint">
            Retrieved for context — related passages not directly cited in the
            summary above.
          </p>
          <div className="evidence-support__list">
            {supporting.map((source) => (
              <SupportingEvidenceRow
                key={source.index}
                source={source}
                citeNumber={source.index}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
