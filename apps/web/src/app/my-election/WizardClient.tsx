"use client";

import { useState, useCallback } from "react";
import { MY_ELECTION_TOPICS } from "@knesset-vote/shared";
import type { RecommendationResponse } from "@knesset-vote/shared";
import { TopicChip } from "@/components/my-election/TopicChip";
import { WeightSlider } from "@/components/my-election/WeightSlider";
import { FreeTextInput } from "@/components/my-election/FreeTextInput";
import { PartyRecommendationCard } from "@/components/my-election/PartyRecommendationCard";

type Step = 1 | 2 | 3 | "results";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

const STEP_LABELS: Record<Exclude<Step, "results">, string> = {
  1: "בחירת נושאים",
  2: "קביעת חשיבות",
  3: "טקסט חופשי",
};

export function WizardClient() {
  const [step, setStep] = useState<Step>(1);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTopicToggle = useCallback((id: string) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Set default weight of 3
    setWeights((prev) => ({ ...prev, [id]: prev[id] ?? 3 }));
  }, []);

  const handleAddTopicFromFreeText = useCallback((topicId: string) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      next.add(topicId);
      return next;
    });
    setWeights((prev) => ({ ...prev, [topicId]: prev[topicId] ?? 3 }));
  }, []);

  const handleWeightChange = useCallback((topicId: string, value: number) => {
    setWeights((prev) => ({ ...prev, [topicId]: value }));
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const topics = Array.from(selectedTopicIds).map((id) => ({
        id,
        weight: weights[id] ?? 3,
      }));

      const res = await fetch(`${API_BASE}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, free_text: freeText || undefined }),
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (res.status === 503) {
          setError(
            "נתוני ההמלצות עדיין לא מוכנים. אנא נסה שוב מאוחר יותר.",
          );
        } else {
          setError((body.message as string) ?? `שגיאה ${res.status}`);
        }
        return;
      }

      const data = await res.json() as RecommendationResponse;
      setResults(data);
      setStep("results");
    } catch {
      setError("שגיאת רשת — אנא בדוק את החיבור ונסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setStep(1);
    setSelectedTopicIds(new Set());
    setWeights({});
    setFreeText("");
    setResults(null);
    setError(null);
  };

  // Scoring topics = selected non-uiOnly topics with topic_keys
  const scoringTopics = Array.from(selectedTopicIds).filter((id) => {
    const def = MY_ELECTION_TOPICS.find((t) => t.id === id);
    return def && !def.uiOnly && def.topic_keys.length > 0;
  });

  const canProceedStep1 = selectedTopicIds.size >= 1;
  const canProceedStep2 = scoringTopics.length >= 1;

  // Progress bar percent
  const stepNum = step === "results" ? 4 : (step as number);
  const progressPct = ((stepNum - 1) / 3) * 100;

  return (
    <div className="mt-6">
      {/* Progress bar */}
      {step !== "results" && (
        <div className="mb-6">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-valuenow={stepNum}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label={`שלב ${stepNum} מתוך 3`}
          >
            <div
              className="h-full rounded-full bg-brand-700 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-neutral-500">
            {([1, 2, 3] as const).map((s) => (
              <span
                key={s}
                className={step === s ? "font-semibold text-brand-700" : ""}
              >
                שלב {s}: {STEP_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Topic selection ── */}
      {step === 1 && (
        <div>
          <h2 className="mb-2 text-xl font-semibold text-neutral-900">
            אילו נושאים חשובים לך?
          </h2>
          <p className="mb-5 text-sm text-neutral-500">
            בחר לפחות נושא אחד. ניתן לבחור עד 10 נושאים.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MY_ELECTION_TOPICS.map((topic) => (
              <TopicChip
                key={topic.id}
                id={topic.id}
                label={topic.label_he}
                isSelected={selectedTopicIds.has(topic.id)}
                isUiOnly={topic.uiOnly}
                onToggle={handleTopicToggle}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              הבא ←
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Weight sliders ── */}
      {step === 2 && (
        <div>
          <h2 className="mb-2 text-xl font-semibold text-neutral-900">
            כמה חשוב לך כל נושא?
          </h2>
          <p className="mb-5 text-sm text-neutral-500">
            קבע את החשיבות היחסית של כל נושא (1 = מעט, 5 = קריטי)
          </p>

          {selectedTopicIds.size === 0 ? (
            <p className="text-sm text-neutral-500">
              לא נבחרו נושאים. חזור לשלב הקודם.
            </p>
          ) : (
            <div className="space-y-5">
              {Array.from(selectedTopicIds).map((id) => {
                const def = MY_ELECTION_TOPICS.find((t) => t.id === id);
                if (!def || def.uiOnly) return null;
                return (
                  <WeightSlider
                    key={id}
                    topicId={id}
                    label={def.label_he}
                    value={weights[id] ?? 3}
                    onChange={handleWeightChange}
                  />
                );
              })}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary"
            >
              ← חזור
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              הבא ←
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Free text ── */}
      {step === 3 && (
        <div>
          <h2 className="mb-2 text-xl font-semibold text-neutral-900">
            יש עוד משהו שחשוב לך?
          </h2>
          <p className="mb-5 text-sm text-neutral-500">
            כתוב בחופשיות — המערכת תזהה מילות מפתח ותציע נושאים נוספים.
          </p>
          <FreeTextInput
            value={freeText}
            onChange={setFreeText}
            selectedTopicIds={selectedTopicIds}
            onAddTopic={handleAddTopicFromFreeText}
          />

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-secondary"
              disabled={loading}
            >
              ← חזור
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !canProceedStep2}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  מחשב...
                </span>
              ) : (
                "הצג המלצות ←"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {step === "results" && results && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900">
              הסיעות המובילות עבורך
            </h2>
            <button
              type="button"
              onClick={handleRestart}
              className="btn-secondary text-sm"
            >
              ← התחל מחדש
            </button>
          </div>

          {/* Warning banner */}
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ⚠️ {results.meta.warning}
          </div>

          <div className="space-y-6">
            {results.results.map((r) => (
              <PartyRecommendationCard key={r.party.id} result={r} />
            ))}
          </div>

          {/* Free text suggestions */}
          {results.free_text_suggestions && results.free_text_suggestions.length > 0 && (
            <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
              <p className="font-medium text-brand-800 mb-2">
                נושאים נוספים שזיהינו בטקסט שלך:
              </p>
              <ul className="space-y-1 text-brand-700">
                {results.free_text_suggestions.map((s) => (
                  <li key={s.suggested_topic_id}>
                    <span className="font-medium">{s.label_he}</span>
                    {" "}(מילת מפתח: {s.matched_keyword})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Methodology link */}
          <div className="mt-6 text-center text-sm text-neutral-500">
            <a
              href="/methodology#my-election-scoring"
              className="text-brand-600 hover:underline"
            >
              כיצד מחושב הציון? ←
            </a>
            {" "}•{" "}
            <span>
              נתונים נכון ל:{" "}
              {results.meta.data_as_of
                ? new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(
                    new Date(results.meta.data_as_of),
                  )
                : "לא ידוע"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
