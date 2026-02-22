import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { MetricCard } from "@/components/shared/MetricCard";
import { OfficialLinksCard } from "@/components/shared/OfficialLinksCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TopicBreakdownChart } from "@/components/mk/TopicBreakdownChart";
import { CommitteeList } from "@/components/mk/CommitteeList";
import { AgendaCard } from "@/components/mk/AgendaCard";
import { RecentBillsList } from "@/components/mk/RecentBillsList";
import { formatDate, formatDateShort } from "@/lib/utils";
import type { MKDetail } from "@knesset-vote/shared";
import { AskAiButton } from "@/components/shared/AskAiButton";

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
    description: `פרופיל ${mk.name_he} — ${mk.current_party_name ?? 'ח"כ'}`,
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
            className="bg-brand-100 text-brand-700 flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
            aria-hidden="true"
          >
            {mk.name_he.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">{mk.name_he}</h1>
                {mk.name_en && <p className="text-neutral-500">{mk.name_en}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mk.is_current ? (
                  <span className="badge bg-green-100 px-3 py-1 text-green-800">
                    חבר/ת כנסת פעיל/ה
                  </span>
                ) : (
                  <span className="badge-unknown badge px-3 py-1">לשעבר</span>
                )}
                {mk.profile?.gender && mk.profile.gender !== "unknown" && (
                  <span className="badge bg-neutral-100 px-2 py-1 text-neutral-600">
                    {mk.profile.gender_label_he}
                  </span>
                )}
                {mk.special_roles &&
                  mk.special_roles
                    .filter((r) => r.is_current)
                    .map((r) => (
                      <span
                        key={r.position_id}
                        className="badge bg-purple-100 px-2 py-1 text-purple-800"
                      >
                        {r.position_label_he}
                      </span>
                    ))}
                {mk.profile?.knesset_terms && mk.profile.knesset_terms.length > 0 && (
                  <span className="badge bg-brand-50 text-brand-700 px-2 py-1">
                    {mk.profile.knesset_terms.length} כנסות
                  </span>
                )}
              </div>
            </div>

            {mk.current_party_name && (
              <p className="mt-2 text-neutral-700">
                סיעה:{" "}
                {mk.current_party_id ? (
                  <Link
                    href={`/parties/${mk.current_party_id}`}
                    className="text-brand-600 font-medium hover:underline"
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
              <OfficialLinksCard entityType="mk" externalId={mk.external_id} />
            </div>
            <AskAiButton
              defaultQuestion={`מה הפעילות החקיקתית של ${mk.name_he}?`}
              suggestions={[
                `כמה הצעות חוק הגיש/ה ${mk.name_he}?`,
                `באיזה ועדות חבר/ה ${mk.name_he}?`,
                `מה עמדות ${mk.name_he} בנושאי ביטחון?`,
              ]}
            />
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
            tooltip="מספר ועדות כנסת שבהן חבר/ת הכנסת רשומ/ה — לפי Knesset OData"
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
                        className="text-brand-600 font-medium hover:underline"
                      >
                        {m.party_name_he}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{m.knesset_number ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-500">{formatDateShort(m.start_date)}</td>
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

      {/* Profile & agenda card */}
      {mk.profile && (
        <section className="mb-8" aria-labelledby="agenda-heading">
          <h2 id="agenda-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            פרופיל וניסיון
          </h2>
          <AgendaCard
            profile={mk.profile}
            topTopics={mk.topic_breakdown ?? []}
            name_he={mk.name_he}
            is_current={mk.is_current}
          />
          {mk.special_roles && mk.special_roles.length > 0 && (
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-purple-900">תפקידים מיוחדים</h3>
              <ul className="space-y-2 text-sm text-purple-800">
                {mk.special_roles.map((r, i) => (
                  <li key={`${r.position_id}-${i}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.position_label_he}</span>
                    {r.knesset_number && (
                      <span className="text-purple-600">· כנסת {r.knesset_number}</span>
                    )}
                    {r.start_date && (
                      <span className="text-purple-600">
                        · {formatDateShort(r.start_date)}
                        {r.end_date
                          ? ` – ${formatDateShort(r.end_date)}`
                          : r.is_current
                            ? " – היום"
                            : ""}
                      </span>
                    )}
                    {r.is_current && (
                      <span className="badge bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800">
                        נוכחי
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-purple-200 pt-2 text-xs text-purple-600">
                מקור: Knesset OData KNS_PersonToPosition
              </p>
            </div>
          )}
        </section>
      )}

      {/* Topic breakdown */}
      {mk.topic_breakdown && mk.topic_breakdown.length > 0 && (
        <section className="mb-8" aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            נושאי חקיקה
          </h2>
          <div className="card p-5">
            <TopicBreakdownChart topics={mk.topic_breakdown} />
          </div>
        </section>
      )}

      {/* Committee list */}
      {mk.committee_list && mk.committee_list.length > 0 && (
        <section className="mb-8" aria-labelledby="committees-heading">
          <h2 id="committees-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            ועדות כנסת
          </h2>
          <CommitteeList committees={mk.committee_list} />
          <p className="mt-2 text-xs text-neutral-400">
            מקור: Knesset OData • ראו{" "}
            <a href="/methodology" className="hover:text-brand-700 underline">
              מתודולוגיה
            </a>
          </p>
        </section>
      )}

      {/* Recent bills */}
      <RecentBillsList bills={mk.recent_bills} mkId={mk.id} />
    </div>
  );
}
