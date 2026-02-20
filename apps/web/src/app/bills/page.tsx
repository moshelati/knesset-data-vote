import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { formatDateShort } from "@/lib/utils";
import { BILL_TOPIC_LABELS } from "@knesset-vote/shared";
import type { Bill } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "הצעות חוק",
  description: "הצעות חוק בכנסת ישראל עם נתוני מצב ומגישים",
};

interface BillsResponse {
  data: Bill[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getBills(opts: {
  search?: string;
  topic?: string;
  status?: string;
}): Promise<BillsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (opts.search) params.set("search", opts.search);
    if (opts.topic) params.set("topic", opts.topic);
    if (opts.status) params.set("status", opts.status);
    params.set("limit", "30");
    return await apiFetch<BillsResponse>(`/api/bills?${params.toString()}`);
  } catch {
    return null;
  }
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: { search?: string; topic?: string; status?: string };
}) {
  const { search, topic, status } = searchParams;
  const response = await getBills({ search, topic, status });
  const bills = response?.data ?? [];
  const hasDemo = bills.some((b) => (b as Bill & { is_demo?: boolean }).is_demo);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">הצעות חוק</h1>
        <p className="mt-2 text-neutral-600">
          {response?.total ?? 0} הצעות חוק • נתונים מ-Knesset OData
        </p>
      </div>

      {hasDemo && <DemoBanner />}

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="חפש שם הצעת חוק..."
          className="flex-1 min-w-48 rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none"
          aria-label="חיפוש הצעת חוק"
        />
        <select
          name="topic"
          defaultValue={topic ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none"
          aria-label="בחר נושא"
        >
          <option value="">כל הנושאים</option>
          {Object.entries(BILL_TOPIC_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none"
          aria-label="בחר מצב"
        >
          <option value="">כל המצבים</option>
          <option value="submitted">הוגשה</option>
          <option value="committee_review">בוועדה</option>
          <option value="first_reading">קריאה ראשונה</option>
          <option value="passed">אושרה</option>
          <option value="rejected">נדחתה</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          סנן
        </button>
        {(search || topic || status) && (
          <Link
            href="/bills"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            נקה
          </Link>
        )}
      </form>

      {bills.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">לא נמצאו הצעות חוק</p>
          <p className="mt-2 text-sm text-neutral-400">
            הפעל <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני הכנסת
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <Link
              key={bill.id}
              href={`/bills/${bill.id}`}
              className="card group block p-5 transition-shadow hover:shadow-md"
              aria-label={`עיין בהצעת החוק: ${bill.title_he}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="font-semibold text-neutral-900 group-hover:text-brand-700">
                    {bill.title_he}
                  </h2>
                  {bill.title_en && (
                    <p className="mt-0.5 text-sm text-neutral-500">{bill.title_en}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <BillStatusBadge status={bill.status ?? "unknown"} />
                    {bill.topic && bill.topic in BILL_TOPIC_LABELS && (
                      <span className="badge bg-blue-50 text-blue-700">
                        {BILL_TOPIC_LABELS[bill.topic as keyof typeof BILL_TOPIC_LABELS]}
                      </span>
                    )}
                    {bill.knesset_number && (
                      <span className="text-xs text-neutral-400">
                        כנסת {bill.knesset_number}
                      </span>
                    )}
                    {bill.submitted_date && (
                      <span className="text-xs text-neutral-400">
                        {formatDateShort(bill.submitted_date)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <SourceBadge sources={bill.sources} compact />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
