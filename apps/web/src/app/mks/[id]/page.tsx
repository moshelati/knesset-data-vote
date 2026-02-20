import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { MetricCard } from "@/components/shared/MetricCard";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import { OfficialLinksCard } from "@/components/shared/OfficialLinksCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { formatDate, formatDateShort } from "@/lib/utils";
import type { MKDetail } from "@knesset-vote/shared";

interface MKDetailResponse {
  data: MKDetail & { is_demo?: boolean };
  computed_fields: Record<string, unknown>;
}

async function getMK(id: string): Promise<(MKDetail & { is_demo?: boolean }) | null> {
  try {
    const res = await apiFetch<MKDetailResponse>(`/api/mks/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const mk = await getMK(params.id);
  if (!mk) return { title: "חבר כנסת לא נמצא" };
  return {
    title: mk.name_he,
    description: `פרופיל ${mk.name_he} — ${mk.current_party_name ?? "ח\"כ"}`,
  };
}

export default async function MKPage({ params }: { params: { id: string } }) {
  const mk = await getMK(params.id);
  if (!mk) notFound();

  const metrics = mk.activity_metrics;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "ראשי", href: "/" },
          { label: "חברי כנסת", href: "/mks" },
          { label: mk.name_he },
        ]}
      />

      {mk.is_demo && <DemoBanner />}

      {/* Profile header */}
      <div className="card mb-8 p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700"
            aria-hidden="true"
          >
            {mk.name_he.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">{mk.name_he}</h1>
                {mk.name_en && (
                  <p className="text-neutral-500">{mk.name_en}</p>
                )}
              </div>
              {mk.is_current ? (
                <span className="badge bg-green-100 text-green-800 px-3 py-1">
                  חבר/ת כנסת פעיל/ה
                </span>
              ) : (
                <span className="badge-unknown badge px-3 py-1">לשעבר</span>
              )}
            </div>

            {mk.current_party_name && (
              <p className="mt-2 text-neutral-700">
                סיעה:{" "}
                {mk.current_party_id ? (
                  <Link
                    href={`/parties/${mk.current_party_id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {mk.current_party_name}
                  </Link>
                ) : (
                  mk.current_party_name
                )}
              </p>
            )}

            <div className="mt-3">
              <SourceBadge sources={mk.sources} />
            </div>
            <div className="mt-4">
              <OfficialLinksCard
                entityType="mk"
                externalId={mk.external_id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activity metrics */}
      <section className="mb-8" aria-labelledby="metrics-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="metrics-heading" className="text-xl font-semibold text-neutral-900">
            מדדי פעילות
          </h2>
          <ConfidenceBadge
            level={metrics.confidence}
            tooltip="רמת הביטחון מבוססת על נוכחות קישורי מקור ישירים מ-Knesset OData"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="הצעות חוק שהגיש/ה"
            value={metrics.bills_initiated}
            tooltip="ספירת הצעות חוק בהן חבר/ת הכנסת רשום/ה כמגיש/ה ראשי/ת — לפי Knesset OData"
            confidence={metrics.bills_initiated > 0 ? "high" : "low"}
          />
          <MetricCard
            label="שותפות להגשה"
            value={metrics.bills_cosponsored}
            tooltip="הצעות חוק בהן רשום/ה כשותפ/ת להגשה — לפי Knesset OData"
            confidence={metrics.bills_cosponsored > 0 ? "high" : "low"}
          />
          <MetricCard
            label="חוקים שעברו"
            value={metrics.bills_passed}
            tooltip="הצעות חוק שהוגשו על ידי חבר/ת הכנסת ואושרו בקריאה שלישית"
            confidence={metrics.bills_passed > 0 ? "high" : "low"}
          />
          <MetricCard
            label="חברויות בוועדות"
            value={metrics.committee_memberships}
            tooltip="חברויות פעילות בוועדות כנסת — לפי Knesset OData"
            confidence={metrics.committee_memberships !== null ? "high" : "unavailable"}
          />
          <MetricCard
            label="השתתפות בהצבעות"
            value={metrics.votes_participated}
            tooltip="מספר הצבעות שתועדו — לפי Knesset OData. ייתכן שהנתון אינו מלא."
            confidence={metrics.votes_participated !== null ? "medium" : "unavailable"}
          />
        </div>

        {metrics.notes.length > 0 && (
          <div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
            {metrics.notes.map((note, i) => (
              <p key={i}>{note}</p>
            ))}
          </div>
        )}

        {metrics.data_as_of && (
          <p className="mt-2 text-xs text-neutral-400">
            נתונים נכון ל: {formatDate(metrics.data_as_of)} •{" "}
            <Link href="/methodology#mks" className="underline">
              מתודולוגיה
            </Link>
          </p>
        )}
      </section>

      {/* Faction history */}
      {mk.memberships.length > 0 && (
        <section className="mb-8" aria-labelledby="memberships-heading">
          <h2 id="memberships-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            היסטוריית סיעה
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-neutral-700">סיעה</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">כנסת</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">מתאריך</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">עד תאריך</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {mk.memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/parties/${m.party_id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {m.party_name_he}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {m.knesset_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {formatDateShort(m.start_date)}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {m.is_current ? "עד היום" : formatDateShort(m.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      {m.is_current ? (
                        <span className="badge bg-green-100 text-green-800">נוכחי</span>
                      ) : (
                        <span className="badge-unknown badge">לשעבר</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            מקור: Knesset OData • ראו{" "}
            <Link href="/methodology" className="underline">
              מתודולוגיה
            </Link>
          </p>
        </section>
      )}

      {/* Recent bills */}
      {mk.recent_bills.length > 0 && (
        <section aria-labelledby="bills-heading">
          <h2 id="bills-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            הצעות חוק אחרונות
          </h2>
          <div className="space-y-3">
            {mk.recent_bills.map((bill) => (
              <Link
                key={bill.id}
                href={`/bills/${bill.id}`}
                className="card group block p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900 group-hover:text-brand-700">
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
            <Link
              href={`/bills?mk_id=${mk.id}`}
              className="text-sm text-brand-600 hover:underline"
            >
              הצג את כל הצעות החוק →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
