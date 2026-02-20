"use client";

interface TopicChipProps {
  id: string;
  label: string;
  isSelected: boolean;
  isUiOnly?: boolean;
  onToggle: (id: string) => void;
}

export function TopicChip({ id, label, isSelected, isUiOnly = false, onToggle }: TopicChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      aria-label={`${label}${isUiOnly ? " (השפעה על ממשק בלבד)" : ""}`}
      onClick={() => onToggle(id)}
      className={[
        "relative flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-right transition-all",
        "focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isSelected
          ? "border-brand-700 bg-brand-700 text-white shadow-md"
          : "hover:border-brand-400 hover:bg-brand-50 border-neutral-300 bg-white text-neutral-700",
      ].join(" ")}
    >
      <span className="text-sm font-semibold leading-snug">{label}</span>
      {isUiOnly && (
        <span className={["text-xs", isSelected ? "text-brand-200" : "text-neutral-400"].join(" ")}>
          משפיע על ממשק בלבד
        </span>
      )}
    </button>
  );
}
