"use client";

import Link from "next/link";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import { formatDateShort } from "@/lib/utils";

interface Bill {
  id: string;
  title_he: string;
  title_en: string | null;
  status: string | null;
  submitted_date: string | null;
  role: string;
  source_url: string | null;
}

interface RecentBillsListProps {
  bills: Bill[];
  mkId: string;
}

export function RecentBillsList({ bills, mkId }: RecentBillsListProps) {
  if (bills.length === 0) return null;

  return (
    <section aria-labelledby="bills-heading">
      <h2 id="bills-heading" className="mb-4 text-xl font-semibold text-neutral-900">
        הצעות חוק אחרונות
      </h2>
      <div className="space-y-3">
        {bills.map((bill) => (
          <Link
            key={bill.id}
            href={`/bills/${bill.id}`}
            className="card group block p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="group-hover:text-brand-700 font-medium text-neutral-900">
                  {bill.title_he}
                </p>
                {bill.title_en && (
                  <p className="mt-0.5 text-sm text-neutral-500">{bill.title_en}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <BillStatusBadge status={bill.status ?? "unknown"} />
                  <span className="badge bg-neutral-100 text-neutral-700">{bill.role}</span>
                  {bill.submitted_date && (
                    <span className="text-xs text-neutral-400">
                      {formatDateShort(bill.submitted_date)}
                    </span>
                  )}
                </div>
              </div>
              {bill.source_url && (
                <a
                  href={bill.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`מקור לחוק: ${bill.title_he}`}
                >
                  מקור ↗
                </a>
              )}
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <Link href={`/bills?mk_id=${mkId}`} className="text-brand-600 text-sm hover:underline">
          הצג את כל הצעות החוק →
        </Link>
      </div>
    </section>
  );
}
