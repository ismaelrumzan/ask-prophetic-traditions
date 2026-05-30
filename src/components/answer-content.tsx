import { splitAnswerWithCites } from "@/lib/citations";
import type { HadithSource } from "@/lib/types";

export function AnswerContent({
  content,
  sources,
}: {
  content: string;
  sources?: HadithSource[];
}) {
  const parts = splitAnswerWithCites(content);

  return (
    <div className="answer-content">
      {parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {part.value}
            </span>
          );
        }

        const source = sources?.[part.index];
        const label = source?.hadithNumber
          ? `[${part.index + 1}]`
          : `[${part.index + 1}]`;

        return source?.referenceUrl ? (
          <a
            key={i}
            href={source.referenceUrl}
            className="cite-pill"
            target="_blank"
            rel="noopener noreferrer"
            title={source.collectionLabel ?? "Hadith source"}
          >
            {label}
          </a>
        ) : (
          <sup key={i} className="cite-pill cite-pill--static">
            {label}
          </sup>
        );
      })}
    </div>
  );
}
