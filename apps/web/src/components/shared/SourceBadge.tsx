import { ExternalLink } from "lucide-react";
import type { SourceLink } from "@knesset-vote/shared";

interface SourceBadgeProps {
  sources: SourceLink[];
  compact?: boolean;
}

export function SourceBadge({ sources, compact = false }: SourceBadgeProps) {
  if (!sources || sources.length === 0) {
    return (
      <span className="text-xs text-neutral-400" aria-label="Source not available">
        לא זמין ממקור
      </span>
    );
  }

  if (compact) {
    return (
      <a
        href={sources[0]!.url}
        target="_blank"
        rel="noopener noreferrer"
        className="source-link"
        aria-label={`מקור: ${sources[0]!.label}`}
      >
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        <span>{sources[0]!.label}</span>
      </a>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source, i) => (
        <a
          key={i}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link"
          aria-label={`מקור: ${source.label}`}
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span>{source.label}</span>
          {source.external_id && (
            <span className="text-neutral-400">#{source.external_id}</span>
          )}
        </a>
      ))}
    </div>
  );
}
