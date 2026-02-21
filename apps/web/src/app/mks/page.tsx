import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { AdSlot } from "@/components/shared/AdSlot";
import type { MK } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "חברי הכנסת",
  description: "פרופילי חברי הכנסת עם נתוני פעילות מאומתים",
};

type RoleBadge = { label: string; type: "minister" | "committee_chair" };
type MKWithRoles = MK & {
  is_demo?: boolean;
  coalition_status?: "coalition" | "opposition" | null;
  role_badges?: RoleBadge[];
};

interface MKsResponse {
  data: MKWithRoles[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getMKs(opts: {
  search?: string;
  party_id?: string;
  coalition?: string;
  gender?: string;
  role?: string;
}): Promise<MKsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (opts.search) params.set("search", opts.search);
    if (opts.party_id) params.set("party_id", opts.party_id);
    if (opts.coalition) params.set("coalition", opts.coalition);
    if (opts.gender) params.set("gender", opts.gender);
    if (opts.role) params.set("role", opts.role);
    params.set("limit", "200");
    params.set("is_current", "true");
    params.set("knesset_number", "25");
    return await apiFetch<MKsResponse>(`/api/mks?${params.toString()}`);
  } catch {
    return null;
  }
}

interface FilterChipProps {
  label: string;
  param: string;
  value: string;
  current: string | undefined;
  baseHref: string;
  currentParams: URLSearchParams;
}

function FilterChip({ label, param, value, current, currentParams }: FilterChipProps) {
  const isActive = current === value;
  const params = new URLSearchParams(currentParams);
  if (isActive) {
    params.delete(param);
  } else {
    params.set(param, value);
  }
  const href = `/mks${params.toString() ? `?${params.toString()}` : ""}`;
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        isActive
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function MKsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    party_id?: string;
    coalition?: string;
    gender?: string;
    role?: string;
  };
}) {
  const { search, party_id, coalition, gender, role } = searchParams;
  const response = await getMKs({ search, party_id, coalition, gender, role });
  const mks = response?.data ?? [];
  const hasDemo = mks.some((m) => m.is_demo);

  const hasFilters = !!(search || party_id || coalition || gender || role);

  // Build a URLSearchParams from current filters (excluding search — handled by form)
  const filterParams = new URLSearchParams();
  if (search) filterParams.set("search", search);
  if (party_id) filterParams.set("party_id", party_id);
  if (coalition) filterParams.set("coalition", coalition);
  if (gender) filterParams.set("gender", gender);
  if (role) filterParams.set("role", role);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">חברי הכנסת</h1>
        <p className="mt-2 text-neutral-600">
          {mks.length} חברי כנסת{hasFilters ? " (מסוננים)" : " נוכחיים"} • כנסת 25 • נתונים
          מ-Knesset OData
        </p>
      </div>

      {hasDemo && <DemoBanner />}

      {/* Search bar */}
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        {/* Preserve current chip filters across search submits */}
        {coalition && <input type="hidden" name="coalition" value={coalition} />}
        {gender && <input type="hidden" name="gender" value={gender} />}
        {role && <input type="hidden" name="role" value={role} />}
        {party_id && <input type="hidden" name="party_id" value={party_id} />}

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
        {hasFilters && (
          <Link
            href="/mks"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            נקה הכל
          </Link>
        )}
      </form>

      {/* Filter chips */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="סינון חברי כנסת">
        <span className="py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          סינון:
        </span>

        {/* Coalition */}
        <FilterChip
          label="🔵 קואליציה"
          param="coalition"
          value="coalition"
          current={coalition}
          baseHref="/mks"
          currentParams={filterParams}
        />
        <FilterChip
          label="🟠 אופוזיציה"
          param="coalition"
          value="opposition"
          current={coalition}
          baseHref="/mks"
          currentParams={filterParams}
        />

        {/* Gender */}
        <FilterChip
          label="נשים"
          param="gender"
          value="female"
          current={gender}
          baseHref="/mks"
          currentParams={filterParams}
        />
        <FilterChip
          label="גברים"
          param="gender"
          value="male"
          current={gender}
          baseHref="/mks"
          currentParams={filterParams}
        />

        {/* Role */}
        <FilterChip
          label="👑 שרים"
          param="role"
          value="minister"
          current={role}
          baseHref="/mks"
          currentParams={filterParams}
        />
        <FilterChip
          label='✋ יו"ר ועדה'
          param="role"
          value="committee_chair"
          current={role}
          baseHref="/mks"
          currentParams={filterParams}
        />
      </div>

      {mks.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">
            {hasFilters ? "לא נמצאו חברי כנסת התואמים את הסינון." : "לא נמצאו חברי כנסת."}
          </p>
          {!hasFilters && (
            <p className="mt-2 text-sm text-neutral-400">
              הפעל <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני הכנסת
            </p>
          )}
          {hasFilters && (
            <Link href="/mks" className="text-brand-600 mt-3 inline-block text-sm hover:underline">
              הסר סינון
            </Link>
          )}
        </div>
      ) : (
        <>
          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST} className="mb-4" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mks.map((mk) => (
              <Link
                key={mk.id}
                href={`/mks/${mk.id}`}
                className="card group flex items-start gap-3 p-4 transition-shadow hover:shadow-md"
                aria-label={`פרופיל של ${mk.name_he}`}
              >
                {/* Avatar */}
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

                  {/* Role badges */}
                  {mk.role_badges && mk.role_badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {mk.role_badges.map((rb, i) => (
                        <span
                          key={i}
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            rb.type === "minister"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                          title={rb.type === "minister" ? "שר/ה" : 'יו"ר ועדה'}
                        >
                          {rb.type === "minister" ? "👑 " : "✋ "}
                          {rb.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {mk.coalition_status === "coalition" && (
                      <span className="badge bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                        קואליציה
                      </span>
                    )}
                    {mk.coalition_status === "opposition" && (
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
        </>
      )}
    </div>
  );
}
