import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number | null;
  tooltip?: string;
  source?: string;
  confidence?: "high" | "medium" | "low" | "unavailable";
  className?: string;
}

export function MetricCard({
  label,
  value,
  tooltip,
  source,
  confidence,
  className,
}: MetricCardProps) {
  const displayValue = value === null || value === undefined ? "לא זמין ממקור" : String(value);

  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-neutral-600">{label}</span>
        {tooltip && (
          <button
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
            aria-label={`מידע על ${label}: ${tooltip}`}
            title={tooltip}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="mt-2">
        <span
          className={cn(
            "text-2xl font-bold",
            value === null ? "text-neutral-400" : "text-neutral-900",
          )}
        >
          {displayValue}
        </span>
      </div>
      {source && (
        <div className="mt-2">
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 text-xs hover:underline"
          >
            מקור ↗
          </a>
        </div>
      )}
      {confidence && (
        <div className="mt-1">
          <span
            className={cn("text-xs", confidence === "high" ? "text-green-600" : "text-neutral-400")}
          >
            {confidence === "high"
              ? "✓ High confidence"
              : confidence === "unavailable"
                ? "Not available from source"
                : "Limited data"}
          </span>
        </div>
      )}
    </div>
  );
}
