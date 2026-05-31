import {
  parseAnswerSections,
  splitAnswerWithCites,
  trimAnswerForDisplay,
} from "@/lib/answer-format";
import type { HadithSource } from "@/lib/types";

function CitePill({
  index,
  source,
}: {
  index: number;
  source?: HadithSource;
}) {
  const label = `[${index + 1}]`;

  if (source?.referenceUrl) {
    return (
      <a
        href={source.referenceUrl}
        className="cite-pill"
        target="_blank"
        rel="noopener noreferrer"
        title={
          source.collectionLabel && source.hadithNumber
            ? `${source.collectionLabel} · ${source.hadithNumber}`
            : "Hadith source"
        }
      >
        {label}
      </a>
    );
  }

  return (
    <sup className="cite-pill cite-pill--static">{label}</sup>
  );
}

function InlineWithCites({
  text,
  sources,
}: {
  text: string;
  sources?: HadithSource[];
}) {
  const parts = splitAnswerWithCites(text);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <span key={i} className="answer-inline">
              {part.value}
            </span>
          );
        }
        return (
          <CitePill key={i} index={part.index} source={sources?.[part.index]} />
        );
      })}
    </>
  );
}

export function AnswerContent({
  content,
  sources,
}: {
  content: string;
  sources?: HadithSource[];
}) {
  const display = trimAnswerForDisplay(content);
  const parsed = parseAnswerSections(display);

  if (parsed.fallback) {
    return (
      <div className="answer-content">
        <InlineWithCites text={parsed.fallback} sources={sources} />
      </div>
    );
  }

  return (
    <div className="answer-content">
      {parsed.summary ? (
        <section className="answer-section">
          <h3 className="answer-section__title">Summary</h3>
          <p className="answer-section__body">
            <InlineWithCites text={parsed.summary} sources={sources} />
          </p>
        </section>
      ) : null}

      {parsed.themes.length ? (
        <section className="answer-section">
          <h3 className="answer-section__title">Themes</h3>
          <ul className="answer-section__list">
            {parsed.themes.map((theme, index) => (
              <li key={index}>
                <InlineWithCites text={theme} sources={sources} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
