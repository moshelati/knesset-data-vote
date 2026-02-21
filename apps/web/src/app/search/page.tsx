import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import type { MK, Bill, Party } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "חיפוש",
  description: "חפשו חברי כנסת, סיעות והצעות חוק",
};

interface SearchResults {
  mks: MK[];
  parties: Party[];
  bills: Bill[];
}

async function search(q: string): Promise<SearchResults> {
  if (!q || q.trim().length < 2) return { mks: [], parties: [], bills: [] };

  const [mksRes, partiesRes, billsRes] = await Promise.allSettled([
    apiFetch<{ data: MK[] }>(`/api/mks?search=${encodeURIComponent(q)}&limit=5&is_current=false`),
    apiFetch<{ data: Party[] }>(`/api/parties?search=${encodeURIComponent(q)}&limit=5`),
    apiFetch<{ data: Bill[] }>(`/api/bills?search=${encodeURIComponent(q)}&limit=5`),
  ]);

  return {
    mks: mksRes.status === "fulfilled" ? (mksRes.value.data ?? []) : [],
    parties: partiesRes.status === "fulfilled" ? (partiesRes.value.data ?? []) : [],
    bills: billsRes.status === "fulfilled" ? (billsRes.value.data ?? []) : [],
  };
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const results = await search(q);
  const hasResults =
    results.mks.length > 0 || results.parties.length > 0 || results.bills.length > 0;
  const searched = q.length >= 2;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="mb-4 text-3xl font-bold text-neutral-900">חיפוש</h1>

        {/* Search form */}
        <form method="get" className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="חפשו חבר כנסת, סיעה, או הצעת חוק..."
              autoFocus
              className="focus:border-brand-500 focus:ring-brand-200 w-full rounded-lg border border-neutral-300 py-3 pl-4 pr-10 text-base focus:outline-none focus:ring-2"
              aria-label="חיפוש"
            />
          </div>
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-3 font-medium text-white"
          >
            חפש
          </button>
        </form>
      </div>

      {/* Results */}
      {!searched ? (
        <p className="text-center text-neutral-500">הכניסו לפחות 2 תווים לחיפוש</p>
      ) : !hasResults ? (
        <div className="card p-12 text-center">
          <p className="text-lg text-neutral-500">לא נמצאו תוצאות עבור &ldquo;{q}&rdquo;</p>
          <p className="mt-2 text-sm text-neutral-400">נסו מילת חיפוש אחרת</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* MKs */}
          {results.mks.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                חברי כנסת ({results.mks.length})
              </h2>
              <div className="space-y-2">
                {results.mks.map((mk) => (
                  <Link
                    key={mk.id}
                    href={`/mks/${mk.id}`}
                    className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="bg-brand-100 text-brand-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      {mk.name_he.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{mk.name_he}</p>
                      {mk.current_party_name && (
                        <p className="text-sm text-neutral-500">{mk.current_party_name}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href={`/mks?search=${encodeURIComponent(q)}`}
                className="text-brand-600 mt-2 inline-block text-sm hover:underline"
              >
                כל התוצאות ב-חברי כנסת ←
              </Link>
            </section>
          )}

          {/* Parties */}
          {results.parties.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                סיעות ({results.parties.length})
              </h2>
              <div className="space-y-2">
                {results.parties.map((party) => (
                  <Link
                    key={party.id}
                    href={`/parties/${party.id}`}
                    className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="bg-brand-100 text-brand-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg">
                      🏛
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{party.name_he}</p>
                      {party.knesset_number && (
                        <p className="text-sm text-neutral-500">כנסת {party.knesset_number}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href={`/parties?search=${encodeURIComponent(q)}`}
                className="text-brand-600 mt-2 inline-block text-sm hover:underline"
              >
                כל התוצאות ב-סיעות ←
              </Link>
            </section>
          )}

          {/* Bills */}
          {results.bills.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                הצעות חוק ({results.bills.length})
              </h2>
              <div className="space-y-2">
                {results.bills.map((bill) => (
                  <Link
                    key={bill.id}
                    href={`/bills/${bill.id}`}
                    className="card block p-4 transition-shadow hover:shadow-md"
                  >
                    <p className="font-medium text-neutral-900">{bill.title_he}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <BillStatusBadge status={bill.status ?? "unknown"} />
                      {bill.knesset_number && (
                        <span className="text-xs text-neutral-400">כנסת {bill.knesset_number}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href={`/bills?search=${encodeURIComponent(q)}`}
                className="text-brand-600 mt-2 inline-block text-sm hover:underline"
              >
                כל התוצאות ב-הצעות חוק ←
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
