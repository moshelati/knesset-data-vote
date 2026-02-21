import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import type { Party } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "סיעות הכנסת",
  description: "רשימת סיעות הכנסת עם נתוני פעילות מאומתים",
};

interface PartiesResponse {
  data: Party[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type PartyWithCoalition = Party & { coalition_status?: "coalition" | "opposition" | null };

async function getParties(search?: string, knesset?: string): Promise<PartiesResponse | null> {
  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("limit", "100");
    if (knesset) params.set("knesset_number", knesset);
    return await apiFetch<PartiesResponse>(`/api/parties?${params.toString()}`);
  } catch {
    return null;
  }
}

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: { search?: string; knesset?: string; bloc?: string };
}) {
  const { search, knesset = "25", bloc } = searchParams;
  const response = await getParties(search, knesset);
  const allParties = (response?.data ?? []) as PartyWithCoalition[];

  // filter by bloc if needed
  const parties = bloc
    ? allParties.filter((p) =>
        bloc === "coalition" ? p.coalition_status === "coalition" :
        bloc === "opposition" ? p.coalition_status === "opposition" : true
      )
    : allParties;

  const hasDemo = parties.some((p) => (p as Party & { is_demo?: boolean }).is_demo);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">סיעות הכנסת</h1>
        <p className="mt-2 text-neutral-600">
          {response?.total ?? 0} סיעות • נתונים מ-Knesset OData
        </p>
      </div>

      {hasDemo && <DemoBanner />}

      {/* Search + filters */}
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="knesset" value={knesset} />
        <label htmlFor="party-search" className="sr-only">חיפוש סיעה</label>
        <input
          id="party-search"
          type="text"
          name="search"
          defaultValue={search}
          placeholder="חפש סיעה..."
          className="focus:border-brand-500 flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none"
        />
        <select
          name="bloc"
          defaultValue={bloc ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">כל הסיעות</option>
          <option value="coalition">קואליציה</option>
          <option value="opposition">אופוזיציה</option>
        </select>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          סנן
        </button>
        {(search || bloc) && (
          <Link href="/parties" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            נקה
          </Link>
        )}
      </form>

      {parties.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">
            {search ? `לא נמצאו סיעות עבור "${search}"` : "לא נמצאו סיעות במסד הנתונים."}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            הפעל <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני הכנסת, או{" "}
            <code className="font-mono">pnpm db:seed</code> לנתוני הדגמה.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(parties as PartyWithCoalition[]).map((party) => (
            <Link
              key={party.id}
              href={`/parties/${party.id}`}
              className="card group p-5 transition-shadow hover:shadow-md"
              aria-label={`עיין בסיעת ${party.name_he}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="group-hover:text-brand-700 text-lg font-semibold text-neutral-900 leading-tight">
                    {party.name_he}
                  </h2>
                  {party.name_en && <p className="text-sm text-neutral-500">{party.name_en}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {party.coalition_status === "coalition" && (
                    <span className="badge bg-blue-100 text-blue-800">קואליציה</span>
                  )}
                  {party.coalition_status === "opposition" && (
                    <span className="badge bg-orange-100 text-orange-800">אופוזיציה</span>
                  )}
                  {party.is_active ? (
                    <span className="badge bg-green-100 text-green-800">פעילה</span>
                  ) : (
                    <span className="badge-unknown badge">לא פעילה</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-sm text-neutral-600">
                {party.seat_count !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">מנדטים:</span>
                    <strong>{party.seat_count}</strong>
                  </div>
                )}
                {party.knesset_number !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">כנסת:</span>
                    <span>{party.knesset_number}</span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <SourceBadge sources={party.sources} compact />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
