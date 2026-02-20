import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { MetricCard } from "@/components/shared/MetricCard";
import { OfficialLinksCard } from "@/components/shared/OfficialLinksCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { PartyDetail } from "@knesset-vote/shared";

interface PartyDetailResponse {
  data: PartyDetail & { is_demo?: boolean };
}

async function getParty(id: string): Promise<(PartyDetail & { is_demo?: boolean }) | null> {
  try {
    const res = await apiFetch<PartyDetailResponse>(`/api/parties/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const party = await getParty(params.id);
  if (!party) return { title: "סיעה לא נמצאה" };
  return {
    title: party.name_he,
    description: `פרופיל סיעת ${party.name_he} בכנסת ישראל`,
  };
}

export default async function PartyPage({ params }: { params: { id: string } }) {
  const party = await getParty(params.id);
  if (!party) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "ראשי", href: "/" },
          { label: "סיעות", href: "/parties" },
          { label: party.name_he },
        ]}
      />

      {party.is_demo && <DemoBanner />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{party.name_he}</h1>
            {party.name_en && <p className="mt-1 text-lg text-neutral-500">{party.name_en}</p>}
          </div>
          {party.is_active ? (
            <span className="badge bg-green-100 px-3 py-1 text-sm text-green-800">פעילה</span>
          ) : (
            <span className="badge badge-unknown px-3 py-1 text-sm">לא פעילה</span>
          )}
        </div>

        {party.knesset_number && (
          <p className="mt-2 text-sm text-neutral-600">כנסת ה-{party.knesset_number}</p>
        )}

        {/* Sources */}
        <div className="mt-4">
          <span className="mr-2 text-xs font-medium text-neutral-500">מקורות:</span>
          <SourceBadge sources={party.sources} />
        </div>
        <div className="mt-4">
          <OfficialLinksCard entityType="party" externalId={party.external_id} />
        </div>
      </div>

      {/* Activity metrics */}
      <section className="mb-8" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          סיכום פעילות
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="מנדטים"
            value={party.seat_count}
            tooltip="מספר מנדטים לפי נתוני OData. לא זמין ממקור = לא דווח."
            confidence={party.seat_count !== null ? "high" : "unavailable"}
          />
          <MetricCard
            label="חברי כנסת"
            value={party.mk_count}
            tooltip="מספר חברי הכנסת הנוכחיים בסיעה לפי נתוני OData"
            confidence="high"
          />
          <MetricCard
            label="הצעות חוק שהוגשו"
            value={party.activity_summary.bills_initiated}
            tooltip="ספירת הצעות חוק שחברי הסיעה הגישו כמגיש ראשי — לפי Knesset OData"
            confidence={party.activity_summary.bills_initiated > 0 ? "high" : "low"}
          />
          <MetricCard
            label="חוקים שעברו"
            value={party.activity_summary.bills_passed}
            tooltip="מספר הצעות חוק שאושרו מהכנסת הנוכחית — לפי Knesset OData"
            confidence={party.activity_summary.bills_passed > 0 ? "high" : "low"}
          />
          <MetricCard
            label="חברויות בוועדות (נוכחי)"
            value={party.activity_summary.committee_meetings}
            tooltip="מספר חברויות פעילות בוועדות כנסת — לפי Knesset OData"
            confidence={party.activity_summary.committee_meetings !== null ? "high" : "unavailable"}
          />
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          * נתונים מ-Knesset OData. ראו{" "}
          <Link href="/methodology#parties" className="underline">
            מתודולוגיה
          </Link>{" "}
          לפירוט ומגבלות.
        </p>
      </section>

      {/* Navigation to MK list */}
      <section className="mb-8" aria-labelledby="mks-heading">
        <h2 id="mks-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          חברי כנסת בסיעה
        </h2>
        <Link
          href={`/mks?party_id=${party.id}`}
          className="border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          aria-label={`הצג את חברי הכנסת של סיעת ${party.name_he}`}
        >
          צפה בכל {party.mk_count} חברי הכנסת →
        </Link>
      </section>

      {/* Bills link */}
      <section aria-labelledby="bills-heading">
        <h2 id="bills-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          הצעות חוק
        </h2>
        <Link
          href={`/bills?party_id=${party.id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          עיין בהצעות חוק של סיעה זו →
        </Link>
      </section>
    </div>
  );
}
