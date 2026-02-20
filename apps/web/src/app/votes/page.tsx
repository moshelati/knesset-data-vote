import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import type { Vote } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "הצבעות במליאה",
  description: "הצבעות במליאת הכנסת — תוצאות ועמדות חברי הכנסת",
};

interface VotesResponse {
  data: Vote[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getVotes(opts: {
  result?: string;
  knesset_number?: string;
  search?: string;
  page?: string;
}): Promise<VotesResponse | null> {
  try {
    const params = new URLSearchParams();
    if (opts.result) params.set("result", opts.result);
    if (opts.knesset_number) params.set("knesset_number", opts.knesset_number);
    if (opts.page) params.set("page", opts.page);
    params.set("limit", "30");
    return await apiFetch<VotesResponse>(`/api/votes?${params.toString()}`);
  } catch {
    return null;
  }
}

function VoteResultBadge({ result }: { result: string | null }) {
  if (!result || result === "unknown") {
    return <span className="badge bg-neutral-100 text-neutral-600">לא ידוע</span>;
  }
  if (result === "passed") {
    return <span className="badge badge-passed">עבר</span>;
  }
  return <span className="badge badge-rejected">נדחה</span>;
}

function VoteBar({
  yes,
  no,
  abstain,
}: {
  yes: number | null;
  no: number | null;
  abstain: number | null;
}) {
  const total = (yes ?? 0) + (no ?? 0) + (abstain ?? 0);
  if (total === 0) return null;

  const yesPct = ((yes ?? 0) / total) * 100;
  const noPct = ((no ?? 0) / total) * 100;
  const abstainPct = ((abstain ?? 0) / total) * 100;

  return (
    <div
      className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-neutral-100"
      aria-hidden="true"
    >
      <div className="bg-green-500" style={{ width: `${yesPct}%` }} />
      <div className="bg-red-500" style={{ width: `${noPct}%` }} />
      <div className="bg-neutral-400" style={{ width: `${abstainPct}%` }} />
    </div>
  );
}

const KNESSET_NUMBERS = Array.from({ length: 25 }, (_, i) => 25 - i);

export default async function VotesPage({
  searchParams,
}: {
  searchParams: { result?: string; knesset_number?: string; page?: string };
}) {
  const { result, knesset_number, page } = searchParams;
  const response = await getVotes({ result, knesset_number, page });
  const votes = response?.data ?? [];
  const hasFilters = !!(result || knesset_number);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">הצבעות במליאה</h1>
        <p className="mt-2 text-neutral-600">
          {response?.total != null ? `${response.total.toLocaleString("he-IL")} הצבעות` : "טוען..."}{" "}
          • נתונים מ-Knesset OData v4
        </p>
      </div>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <select
          name="result"
          defaultValue={result ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none"
          aria-label="סנן לפי תוצאה"
        >
          <option value="">כל התוצאות</option>
          <option value="passed">עבר</option>
          <option value="rejected">נדחה</option>
          <option value="unknown">לא ידוע</option>
        </select>

        <select
          name="knesset_number"
          defaultValue={knesset_number ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none"
          aria-label="סנן לפי כנסת"
        >
          <option value="">כל הכנסות</option>
          {KNESSET_NUMBERS.map((n) => (
            <option key={n} value={n}>
              כנסת {n}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          סנן
        </button>
        {hasFilters && (
          <Link
            href="/votes"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            נקה
          </Link>
        )}
      </form>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-green-500" />
          בעד
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-red-500" />
          נגד
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-neutral-400" />
          נמנע
        </span>
      </div>

      {votes.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">לא נמצאו הצבעות</p>
          {!hasFilters && (
            <p className="mt-2 text-sm text-neutral-400">
              הפעל <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני הצבעות
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {votes.map((vote) => (
              <Link
                key={vote.id}
                href={`/votes/${vote.id}`}
                className="card group block p-5 transition-shadow hover:shadow-md"
                aria-label={`עיין בהצבעה: ${vote.title_he}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="group-hover:text-brand-700 truncate font-semibold text-neutral-900">
                      {vote.title_he}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <VoteResultBadge result={vote.result} />
                      {vote.knesset_number && (
                        <span className="text-xs text-neutral-400">כנסת {vote.knesset_number}</span>
                      )}
                      {vote.vote_date && (
                        <span className="text-xs text-neutral-400">
                          {formatDateShort(vote.vote_date)}
                        </span>
                      )}
                      {/* Yes/No/Abstain counts */}
                      {(vote.yes_count != null || vote.no_count != null) && (
                        <span className="flex items-center gap-2 text-xs text-neutral-500">
                          <span className="text-green-600">בעד {vote.yes_count ?? 0}</span>
                          <span className="text-red-600">נגד {vote.no_count ?? 0}</span>
                          {vote.abstain_count != null && vote.abstain_count > 0 && (
                            <span className="text-neutral-400">נמנע {vote.abstain_count}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <VoteBar yes={vote.yes_count} no={vote.no_count} abstain={vote.abstain_count} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {response && response.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {(response.page ?? 1) > 1 && (
                <Link
                  href={`/votes?${new URLSearchParams({ ...(result ? { result } : {}), ...(knesset_number ? { knesset_number } : {}), page: String((response.page ?? 1) - 1) }).toString()}`}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  הקודם
                </Link>
              )}
              <span className="text-sm text-neutral-600">
                עמוד {response.page} מתוך {response.pages}
              </span>
              {(response.page ?? 1) < response.pages && (
                <Link
                  href={`/votes?${new URLSearchParams({ ...(result ? { result } : {}), ...(knesset_number ? { knesset_number } : {}), page: String((response.page ?? 1) + 1) }).toString()}`}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  הבא
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
