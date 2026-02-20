"use client";

import { FREE_TEXT_KEYWORD_MAP, MY_ELECTION_TOPICS } from "@knesset-vote/shared";

interface FreeTextInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedTopicIds: Set<string>;
  onAddTopic: (topicId: string) => void;
}

function detectKeywords(text: string) {
  if (!text.trim()) return [];
  const found: Array<{ keyword: string; topicId: string; labelHe: string }> = [];
  const seen = new Set<string>();

  for (const entry of FREE_TEXT_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (text.includes(kw) && !seen.has(entry.topic_id)) {
        const topic = MY_ELECTION_TOPICS.find((t) => t.id === entry.topic_id);
        if (topic && !topic.uiOnly) {
          found.push({ keyword: kw, topicId: entry.topic_id, labelHe: topic.label_he });
          seen.add(entry.topic_id);
        }
        break;
      }
    }
  }
  return found;
}

export function FreeTextInput({
  value,
  onChange,
  selectedTopicIds,
  onAddTopic,
}: FreeTextInputProps) {
  const suggestions = detectKeywords(value);
  const newSuggestions = suggestions.filter((s) => !selectedTopicIds.has(s.topicId));

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="free-text" className="text-sm font-medium text-neutral-800">
        האם יש נושא ספציפי שחשוב לך? (אופציונלי)
      </label>
      <textarea
        id="free-text"
        rows={3}
        maxLength={500}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="לדוגמה: דיור, ביטחון, תחבורה..."
        className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        dir="rtl"
        aria-describedby={newSuggestions.length > 0 ? "freetext-suggestions" : undefined}
      />
      <div className="flex justify-between text-xs text-neutral-400">
        <span>{value.length}/500</span>
      </div>

      {newSuggestions.length > 0 && (
        <div id="freetext-suggestions" aria-live="polite">
          <p className="mb-2 text-xs text-neutral-600">
            זיהינו מילות מפתח — להוסיף לנושאים שנבחרו?
          </p>
          <div className="flex flex-wrap gap-2">
            {newSuggestions.map((s) => (
              <button
                key={s.topicId}
                type="button"
                onClick={() => onAddTopic(s.topicId)}
                className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs text-brand-700 transition hover:bg-brand-100"
              >
                + {s.labelHe}
                <span className="ml-1 text-neutral-400">({s.keyword})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
