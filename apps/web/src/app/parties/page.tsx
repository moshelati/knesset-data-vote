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

type PartyWithCoalition = Party & {
  coalition_status?: "coalition" | "opposition" | null;
  is_demo?: boolean;
};

interface FactionGroup {
  name_he: string;
  name_en: string | null;
  coalition_status: "coalition" | "opposition" | null | undefined;
  current: PartyWithCoalition | null; // highest knesset_number entry
  all: PartyWithCoalition[]; // sorted desc by knesset_number
}

async function getParties(search?: string): Promise<PartiesResponse | null> {
  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("limit", "500");
    return await apiFetch<PartiesResponse>(`/api/parties?${params.toString()}`);
  } catch {
    return null;
  }
}

function groupByFaction(parties: PartyWithCoalition[]): FactionGroup[] {
  const map = new Map<string, PartyWithCoalition[]>();
  for (const p of parties) {
    const key = p.name_he.trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  const groups: FactionGroup[] = [];
  for (const [name_he, entries] of map) {
    // Sort descending by knesset_number so index 0 is the most recent
    const sorted = entries.sort((a, b) => (b.knesset_number ?? 0) - (a.knesset_number ?? 0));
    const current = sorted[0] ?? null;
    groups.push({
      name_he,
      name_en: current?.name_en ?? null,
      coalition_status: current?.coalition_status,
      current,
      all: sorted,
    });
  }

  // Sort: coalition first, then opposition, then unknown; within each — seats desc, then alpha
  const order = (g: FactionGroup) => {
    if (g.coalition_status === "coalition") return 0;
    if (g.coalition_status === "opposition") return 1;
    return 2;
  };
  groups.sort((a, b) => {
    const od = order(a) - order(b);
    if (od !== 0) return od;
    const seatDiff = (b.current?.seat_count ?? 0) - (a.current?.seat_count ?? 0);
    if (seatDiff !== 0) return seatDiff;
    return a.name_he.localeCompare(b.name_he, "he");
  });

  return groups;
}

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: { search?: string; bloc?: string };
}) {
  const { search, bloc } = searchParams;
  const response = await getParties(search);
  const allParties = (response?.data ?? []) as PartyWithCoalition[];

  const hasDemo = allParties.some((p) => p.is_demo);

  // Build faction groups then optionally filter by bloc
  let groups = groupByFaction(allParties);
  if (bloc === "coalition") {
    groups = groups.filter((g) => g.coalition_status === "coalition");
  } else if (bloc === "opposition") {
    groups = groups.filter((g) => g.coalition_status === "opposition");
  }

  // Separate factions that appear in Knesset 25 from purely historical ones
  const currentGroups = groups.filter(
    (g) => g.current?.knesset_number === 25 || (g.current?.knesset_number ?? 0) >= 25,
  );
  const historicalGroups = groups.filter((g) => (g.current?.knesset_number ?? 0) < 25);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">סיעות הכנסת</h1>
        <p className="mt-2 text-neutral-600">
          {currentGroups.length} סיעות פעילות בכנסת 25 • נתונים מ-Knesset OData
        </p>
      </div>

      {hasDemo && <DemoBanner />}

      {/* Search + bloc filter */}
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <label htmlFor="party-search" className="sr-only">
          חיפוש סיעה
        </label>
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
          <Link
            href="/parties"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            נקה
          </Link>
        )}
      </form>

      {groups.length === 0 ? (
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
        <>
          {/* Current Knesset 25 factions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentGroups.map((group) => (
              <FactionCard key={group.name_he} group={group} />
            ))}
          </div>

          {/* Historical factions accordion */}
          {historicalGroups.length > 0 && !search && !bloc && (
            <details className="group mt-10">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 hover:bg-neutral-50">
                  <span className="text-sm font-medium text-neutral-600">
                    סיעות היסטוריות ({historicalGroups.length})
                  </span>
                  <span className="text-xs text-neutral-400">— לא מיוצגות בכנסת 25</span>
                  <span className="mr-auto text-neutral-400 transition-transform group-open:rotate-180">
                    ▼
                  </span>
                </div>
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {historicalGroups.map((group) => (
                  <FactionCard key={group.name_he} group={group} historical />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function FactionCard({ group, historical = false }: { group: FactionGroup; historical?: boolean }) {
  const party = group.current;
  if (!party) return null;

  const knessetNumbers = group.all
    .map((p) => p.knesset_number)
    .filter((n): n is number => n !== null)
    .sort((a, b) => b - a);
  const hasHistory = knessetNumbers.length > 1;

  return (
    <div className={`card p-5 ${historical ? "opacity-75" : ""}`}>
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/parties/${party.id}`}
            className="group-hover:text-brand-700 hover:text-brand-700 text-lg font-semibold leading-tight text-neutral-900"
          >
            {party.name_he}
          </Link>
          {party.name_en && <p className="text-sm text-neutral-500">{party.name_en}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {group.coalition_status === "coalition" && (
            <span className="badge bg-blue-100 text-blue-800">קואליציה</span>
          )}
          {group.coalition_status === "opposition" && (
            <span className="badge bg-orange-100 text-orange-800">אופוזיציה</span>
          )}
          {party.is_active ? (
            <span className="badge bg-green-100 text-green-800">פעילה</span>
          ) : (
            <span className="badge-unknown badge">לא פעילה</span>
          )}
        </div>
      </div>

      {/* Stats */}
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

      {/* Knesset history accordion */}
      {hasHistory && (
        <details className="group/hist mt-3">
          <summary className="cursor-pointer list-none">
            <span className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600">
              <span className="transition-transform group-open/hist:rotate-90">▶</span>
              היסטוריית כנסות ({knessetNumbers.length})
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {group.all
              .sort((a, b) => (b.knesset_number ?? 0) - (a.knesset_number ?? 0))
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/parties/${p.id}`}
                  className="hover:border-brand-400 hover:text-brand-600 rounded border border-neutral-200 px-2 py-0.5 text-xs text-neutral-500"
                  title={`כנסת ${p.knesset_number}${p.seat_count ? ` — ${p.seat_count} מנדטים` : ""}`}
                >
                  כנסת {p.knesset_number}
                  {p.seat_count ? ` (${p.seat_count})` : ""}
                </Link>
              ))}
          </div>
        </details>
      )}

      <div className="mt-3">
        <SourceBadge sources={party.sources} compact />
      </div>
    </div>
  );
}
