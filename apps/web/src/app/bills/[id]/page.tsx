import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import { OfficialLinksCard } from "@/components/shared/OfficialLinksCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { formatDate, formatDateShort } from "@/lib/utils";
import { BILL_TOPIC_LABELS } from "@knesset-vote/shared";
import type { BillDetail } from "@knesset-vote/shared";
import { AskAiButton } from "@/components/shared/AskAiButton";

interface BillDetailResponse {
  data: BillDetail & { is_demo?: boolean };
  computed_fields: Record<string, unknown>;
}

async function getBill(id: string): Promise<(BillDetail & { is_demo?: boolean }) | null> {
  try {
    const res = await apiFetch<BillDetailResponse>(`/api/bills/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const bill = await getBill(params.id);
  if (!bill) return { title: "הצעת חוק לא נמצאה" };
  return {
    title: bill.title_he,
    description: bill.description_he?.slice(0, 160) ?? `הצעת חוק: ${bill.title_he}`,
  };
}

const STAGE_ORDER = [
  "submitted",
  "committee_review",
  "first_reading",
  "second_reading",
  "third_reading",
  "passed",
  "rejected",
  "withdrawn",
];

export default async function BillPage({ params }: { params: { id: string } }) {
  const bill = await getBill(params.id);
  if (!bill) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "ראשי", href: "/" },
          { label: "הצעות חוק", href: "/bills" },
          { label: bill.title_he },
        ]}
      />

      {bill.is_demo && <DemoBanner />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-neutral-900">{bill.title_he}</h1>
          <BillStatusBadge status={bill.status ?? "unknown"} />
        </div>

        {bill.title_en && <p className="mt-2 text-neutral-500">{bill.title_en}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-600">
          {bill.topic && bill.topic in BILL_TOPIC_LABELS && (
            <span className="badge bg-blue-50 text-blue-700">
              {BILL_TOPIC_LABELS[bill.topic as keyof typeof BILL_TOPIC_LABELS]}
            </span>
          )}
          {bill.knesset_number && <span>כנסת {bill.knesset_number}</span>}
          {bill.submitted_date && <span>הוגשה: {formatDate(bill.submitted_date)}</span>}
        </div>

        {/* Sources */}
        <div className="mt-4">
          <span className="mr-2 text-xs font-medium text-neutral-500">מקורות:</span>
          <SourceBadge sources={bill.sources} />
        </div>

        {bill.source_url && (
          <a
            href={bill.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 mt-2 inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            צפה במקור הרשמי בכנסת
          </a>
        )}
        <div className="mt-4">
          <OfficialLinksCard entityType="bill" externalId={bill.external_id} />
        </div>
        <AskAiButton
          defaultQuestion={`מה הצעת החוק "${bill.title_he}" עוסקת בה?`}
          suggestions={[
            `מה המצב הנוכחי של הצעת החוק "${bill.title_he}"?`,
            `מי הגיש את הצעת החוק "${bill.title_he}"?`,
          ]}
        />
      </div>

      {/* AI Summary (if available) */}
      {bill.ai_summary && (
        <section
          className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-5"
          aria-labelledby="ai-summary-heading"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h2 id="ai-summary-heading" className="font-semibold text-amber-900">
                סיכום AI
              </h2>
              <p className="mt-1 text-sm text-amber-700">{bill.ai_summary.warning}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-neutral-700">{bill.ai_summary.text}</p>
          <p className="mt-2 text-xs text-neutral-400">
            מודל: {bill.ai_summary.model} • נוצר: {formatDate(bill.ai_summary.generated_at)}
          </p>
        </section>
      )}

      {/* Official description */}
      {bill.description_he && (
        <section className="mb-8" aria-labelledby="description-heading">
          <h2 id="description-heading" className="mb-3 text-xl font-semibold text-neutral-900">
            תיאור רשמי
          </h2>
          <div className="card p-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {bill.description_he}
            </p>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            מקור: Knesset OData — תיאור רשמי ממאגר הכנסת
          </p>
        </section>
      )}

      {/* Sponsors */}
      {bill.sponsors.length > 0 && (
        <section className="mb-8" aria-labelledby="sponsors-heading">
          <h2 id="sponsors-heading" className="mb-3 text-xl font-semibold text-neutral-900">
            מגישים
          </h2>
          <div className="flex flex-wrap gap-2">
            {bill.sponsors.map((s) => (
              <Link
                key={`${s.mk_id}-${s.role}`}
                href={`/mks/${s.mk_id}`}
                className="card inline-flex items-center gap-2 px-3 py-2 text-sm hover:shadow-md"
              >
                <span className="font-medium text-neutral-900">{s.mk_name_he}</span>
                <span className="text-xs text-neutral-500">
                  {s.role === "initiator" ? "מגיש/ה" : "שותפ/ה"}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-400">מקור: Knesset OData</p>
        </section>
      )}

      {/* Stage history timeline */}
      {bill.stage_history.length > 0 && (
        <section aria-labelledby="stages-heading">
          <h2 id="stages-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            היסטוריית מצב
          </h2>
          <div className="relative">
            <div
              className="absolute bottom-0 right-4 top-0 w-0.5 bg-neutral-200"
              aria-hidden="true"
            />
            <div className="space-y-4">
              {bill.stage_history.map((stage, index) => (
                <div key={stage.id} className="relative flex items-start gap-4">
                  <div
                    className="border-brand-400 text-brand-600 relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white text-xs font-bold"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </div>
                  <div className="card flex-1 p-3">
                    <p className="font-medium text-neutral-900">{stage.stage_name_he}</p>
                    {stage.status && stage.status !== stage.stage_name_he && (
                      <p className="mt-0.5 text-sm text-neutral-600">{stage.status}</p>
                    )}
                    {stage.date && (
                      <p className="mt-1 text-xs text-neutral-400">{formatDateShort(stage.date)}</p>
                    )}
                    {stage.notes && <p className="mt-1 text-xs text-neutral-500">{stage.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-neutral-400">
            מקור: Knesset OData •{" "}
            <Link href="/methodology#bills" className="underline">
              מתודולוגיה
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
