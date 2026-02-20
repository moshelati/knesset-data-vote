import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { SourceBadge } from "@/components/shared/SourceBadge";
import type { RecommendationResult, ConfidenceLevel } from "@knesset-vote/shared";

interface PartyRecommendationCardProps {
  result: RecommendationResult;
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`ציון ${pct.toFixed(1)} מתוך 100`}
    >
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PartyRecommendationCard({ result }: PartyRecommendationCardProps) {
  const { rank, party, personal_score, confidence, topic_breakdown, highlights } = result;

  return (
    <article className="card overflow-hidden" aria-label={`מקום ${rank}: ${party.name_he}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-neutral-100 p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">
            {RANK_MEDAL[rank] ?? `#${rank}`}
          </span>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">{party.name_he}</h3>
            {party.name_en && <p className="text-sm text-neutral-500">{party.name_en}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-brand-700 text-2xl font-bold">
            {personal_score.toFixed(1)}
            <span className="text-sm font-normal text-neutral-500">/100</span>
          </p>
          <ConfidenceBadge
            level={confidence as ConfidenceLevel}
            tooltip={
              confidence === "high"
                ? "נמצאו נתוני חקיקה ברוב הנושאים שנבחרו"
                : confidence === "medium"
                  ? "נמצאו נתוני חקיקה בחלק מהנושאים"
                  : "נתוני חקיקה מועטים בנושאים שנבחרו"
            }
          />
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 pt-4">
        <ScoreBar score={personal_score} />
      </div>

      {/* Topic breakdown */}
      <div className="p-5">
        <h4 className="mb-3 text-sm font-semibold text-neutral-700">פירוט לפי נושא</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-neutral-200 text-right text-xs text-neutral-500">
                <th className="pb-1 font-medium">נושא</th>
                <th className="pb-1 font-medium">משקל</th>
                <th className="pb-1 font-medium">ציון</th>
                <th className="pb-1 font-medium">הצ"ח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {topic_breakdown.map((tb) => (
                <tr key={tb.ui_topic_id}>
                  <td className="py-1.5 text-neutral-800">{tb.label_he}</td>
                  <td className="py-1.5 text-neutral-600">{tb.weight}</td>
                  <td className="py-1.5">
                    <span
                      className={
                        tb.normalized_score >= 0.6
                          ? "font-semibold text-green-700"
                          : tb.normalized_score >= 0.3
                            ? "text-yellow-700"
                            : "text-neutral-400"
                      }
                    >
                      {(tb.normalized_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-1.5 text-neutral-500">{tb.bill_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="border-t border-neutral-100 p-5">
          <h4 className="mb-3 text-sm font-semibold text-neutral-700">הצעות חוק רלוונטיות</h4>
          <ul className="space-y-3">
            {highlights.map((bill) => (
              <li
                key={bill.bill_id}
                className="rounded-lg border border-neutral-100 bg-neutral-50 p-3"
              >
                <p className="text-sm font-medium leading-snug text-neutral-800">{bill.title_he}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
                    {bill.status}
                  </span>
                  <span className="text-xs text-neutral-400">{bill.topic}</span>
                  <SourceBadge sources={bill.sources} compact />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Party source links */}
      {party.sources.length > 0 && (
        <div className="border-t border-neutral-100 p-5 pt-3">
          <SourceBadge sources={party.sources} compact />
        </div>
      )}
    </article>
  );
}
