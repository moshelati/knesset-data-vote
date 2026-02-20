import type { MKTopicBreakdownItem } from "@knesset-vote/shared";
import Link from "next/link";

interface Props {
  topics: MKTopicBreakdownItem[];
}

export function TopicBreakdownChart({ topics }: Props) {
  if (topics.length === 0) {
    return <p className="text-sm text-neutral-500">אין נתוני חקיקה לפי נושא</p>;
  }

  const maxCount = Math.max(...topics.map((t) => t.bill_count), 1);
  const displayed = topics.slice(0, 8);

  return (
    <div className="space-y-3">
      {displayed.map((topic) => {
        const barPct = Math.round((topic.bill_count / maxCount) * 100);
        const passedPct =
          topic.bill_count > 0 ? Math.round((topic.bills_passed / topic.bill_count) * 100) : 0;

        return (
          <div key={topic.topic} className="group">
            <div className="mb-1 flex items-center justify-between gap-4">
              <span className="text-sm font-medium leading-tight text-neutral-800">
                {topic.label_he}
              </span>
              <span className="shrink-0 text-xs text-neutral-500">
                {topic.bill_count} הצעות
                {topic.bills_passed > 0 && (
                  <span className="text-green-600"> · {topic.bills_passed} עברו</span>
                )}
              </span>
            </div>
            {/* Bar track */}
            <div
              className="relative h-4 w-full overflow-hidden rounded-full bg-neutral-100"
              role="progressbar"
              aria-valuenow={topic.bill_count}
              aria-valuemax={maxCount}
              aria-label={`${topic.label_he}: ${topic.bill_count} הצעות חוק`}
            >
              {/* Total bills bar */}
              <div
                className="bg-brand-200 absolute inset-y-0 right-0 rounded-full transition-all"
                style={{ width: `${barPct}%` }}
              />
              {/* Passed bills overlay */}
              {topic.bills_passed > 0 && (
                <div
                  className="absolute inset-y-0 right-0 rounded-full bg-green-400 transition-all"
                  style={{ width: `${barPct * (passedPct / 100)}%` }}
                />
              )}
            </div>
          </div>
        );
      })}

      <p className="mt-2 text-xs text-neutral-400">
        מבוסס על נושאי הצעות חוק מ-Knesset OData •{" "}
        <Link href="/methodology#topics" className="hover:text-brand-700 underline">
          מתודולוגיה
        </Link>
      </p>
    </div>
  );
}
