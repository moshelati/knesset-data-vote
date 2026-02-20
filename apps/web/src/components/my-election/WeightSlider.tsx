"use client";

interface WeightSliderProps {
  topicId: string;
  label: string;
  value: number;
  onChange: (topicId: string, value: number) => void;
}

const WEIGHT_LABELS: Record<number, string> = {
  1: "מעט חשוב",
  2: "חשוב במידת מה",
  3: "חשוב",
  4: "חשוב מאוד",
  5: "קריטי",
};

export function WeightSlider({ topicId, label, value, onChange }: WeightSliderProps) {
  const sliderId = `weight-${topicId}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={sliderId} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
        <span
          className="bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 text-xs font-semibold"
          aria-live="polite"
          aria-label={`חשיבות: ${WEIGHT_LABELS[value] ?? value}`}
        >
          {WEIGHT_LABELS[value] ?? value}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-400">1</span>
        <input
          id={sliderId}
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(topicId, Number(e.target.value))}
          className="accent-brand-700 h-2 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={value}
          aria-valuetext={WEIGHT_LABELS[value]}
        />
        <span className="text-xs text-neutral-400">5</span>
      </div>
    </div>
  );
}
