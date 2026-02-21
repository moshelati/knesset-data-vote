import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import type { MK } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "חברי הכנסת",
  description: "פרופילי חברי הכנסת עם נתוני פעילות מאומתים",
};

interface MKsResponse {
  data: MK[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getMKs(opts: { search?: string; party_id?: string }): Promise<MKsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (opts.search) params.set("search", opts.search);
    if (opts.party_id) params.set("party_id", opts.party_id);
    params.set("limit", "200");
    params.set("is_current", "true");
    params.set("knesset_number", "25");
    return await apiFetch<MKsResponse>(`/api/mks?${params.toString()}`);
  } catch {
    return null;
  }
}

export default async function MKsPage({
  searchParams,
}: {
  searchParams: { search?: string; party_id?: string };
}) {
  const { search, party_id } = searchParams;
  const response = await getMKs({ search, party_id });
  const mks = response?.data ?? [];
  const hasDemo = mks.some((m) => (m as MK & { is_demo?: boolean }).is_demo);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">חברי הכנסת</h1>
        <p className="mt-2 text-neutral-600">
          {mks.length} חברי כנסת נוכחיים • כנסת 25 • נתונים מ-Knesset OData
        </p>
      </div>

      {hasDemo && <DemoBanner />}

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <label htmlFor="mk-search" className="sr-only">
          חיפוש חבר כנסת
        </label>
        <input
          id="mk-search"
          type="text"
          name="search"
          defaultValue={search}
          placeholder="חפש שם..."
          className="focus:border-brand-500 flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          חפש
        </button>
        {(search || party_id) && (
          <Link
            href="/mks"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            נקה סינון
          </Link>
        )}
      </form>

      {mks.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">
            {search ? `לא נמצאו חברי כנסת עבור "${search}"` : "לא נמצאו חברי כנסת."}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            הפעל <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני הכנסת
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mks.map((mk) => (
            <Link
              key={mk.id}
              href={`/mks/${mk.id}`}
              className="card group flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
              aria-label={`פרופיל של ${mk.name_he}`}
            >
              {/* Avatar placeholder */}
              <div
                className="bg-brand-100 text-brand-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                aria-hidden="true"
              >
                {mk.name_he.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="group-hover:text-brand-700 truncate font-medium text-neutral-900">
                  {mk.name_he}
                </p>
                {mk.current_party_name && (
                  <p className="truncate text-xs text-neutral-500">{mk.current_party_name}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {(mk as MK & { coalition_status?: string | null }).coalition_status ===
                    "coalition" && (
                    <span className="badge bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                      קואליציה
                    </span>
                  )}
                  {(mk as MK & { coalition_status?: string | null }).coalition_status ===
                    "opposition" && (
                    <span className="badge bg-orange-50 px-1.5 py-0.5 text-xs text-orange-700">
                      אופוזיציה
                    </span>
                  )}
                  <SourceBadge sources={mk.sources} compact />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
