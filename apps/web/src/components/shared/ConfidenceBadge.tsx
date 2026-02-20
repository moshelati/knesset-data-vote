import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low" | "unavailable";
  tooltip?: string;
}

const LABELS = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Limited data",
  unavailable: "Not available from source",
};

const CLASSES = {
  high: "text-green-700 bg-green-50 border-green-200",
  medium: "text-yellow-700 bg-yellow-50 border-yellow-200",
  low: "text-red-600 bg-red-50 border-red-200",
  unavailable: "text-neutral-500 bg-neutral-50 border-neutral-200",
};

export function ConfidenceBadge({ level, tooltip }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        CLASSES[level],
      )}
      title={tooltip ?? LABELS[level]}
      role="img"
      aria-label={`Confidence: ${LABELS[level]}`}
    >
      <Info className="h-3 w-3" aria-hidden="true" />
      {LABELS[level]}
    </span>
  );
}
