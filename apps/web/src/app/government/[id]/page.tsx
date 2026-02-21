import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MetricCard } from "@/components/shared/MetricCard";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { OfficialLinksCard } from "@/components/shared/OfficialLinksCard";
import { CommitteeList } from "@/components/mk/CommitteeList";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import { formatDateShort } from "@/lib/utils";
import type { GovernmentMinisterDetail } from "@knesset-vote/shared";

interface GovernmentDetailResponse {
  data: GovernmentMinisterDetail;
  methodology_url: string;
  computed_fields: Record<string, unknown>;
}

async function getMinister(id: string): Promise<GovernmentMinisterDetail | null> {
  try {
    const res = await apiFetch<GovernmentDetailResponse>(`/api/government/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const minister = await getMinister(params.id);
  if (!minister) return { title: "שר לא נמצא" };
  const name = minister.mk.name_he;
  const duty = minister.role.duty_desc ?? minister.role.ministry_name ?? "שר";
  return {
    title: `${name} — ${duty}`,
    description: `${duty} · ממשלה ${minister.role.government_num ?? 37} · נתונים מ-Knesset OData`,
  };
}

/** Compute time in office string */
function timeInOffice(startDate: string | null): string {
  if (!startDate) return "לא זמין";
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  if (diffMs <= 0) return "לא זמין";
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  if (years === 0 && months === 0) return `${totalDays} ימים`;
  if (years === 0) return `${months} חודשים`;
  if (months === 0) return `${years} שנים`;
  return `${years} שנים ו-${months} חודשים`;
}

export default async function MinisterDetailPage({ params }: { params: { id: string } }) {
  const minister = await getMinister(params.id);
  if (!minister) notFound();

  const { mk, role, related_bills, committee_roles, sources } = minister;
  const isPM = role.position_id === 45;
  const dutyLabel = role.duty_desc ?? role.position_label;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "ראשי", href: "/" },
          { label: "ממשלה", href: "/government" },
          { label: mk.name_he },
        ]}
      />

      {/* Profile header */}
      <div className="card mb-8 p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="shrink-0" aria-hidden="true">
            {mk.image_url ? (
              <Image
                src={mk.image_url}
                alt={mk.name_he}
                width={80}
                height={80}
                className="h-20 w-20 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ${
                  isPM ? "bg-purple-100 text-purple-700" : "bg-brand-100 text-brand-700"
                }`}
              >
                {mk.name_he.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">{mk.name_he}</h1>
                {mk.name_en && <p className="text-neutral-500">{mk.name_en}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isPM && (
                  <span className="badge bg-purple-100 px-3 py-1 text-purple-800">ראש הממשלה</span>
                )}
                <span className="badge bg-green-100 px-3 py-1 text-green-800">שר/ה בתפקיד</span>
              </div>
            </div>

            {/* Ministry / duty */}
            <div className="mt-3 flex flex-wrap gap-2">
              {dutyLabel && (
                <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
                  {dutyLabel}
                </span>
              )}
              {role.ministry_name && role.ministry_name !== dutyLabel && (
                <span className="rounded-md bg-neutral-100 px-3 py-1 text-sm text-neutral-600">
                  {role.ministry_name}
                </span>
              )}
            </div>

            {/* Party */}
            {mk.current_party_name && (
              <p className="mt-2 text-sm text-neutral-600">
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

            {/* Term */}
            <p className="mt-1 text-sm text-neutral-500">
              ממשלה {role.government_num ?? "—"} · כנסת {role.knesset_num ?? "—"}
              {role.start_date && <> · מאז {formatDateShort(role.start_date)}</>}
            </p>

            {/* Source + links */}
            <div className="mt-3">
              <SourceBadge sources={sources} />
            </div>
            <div className="mt-3">
              <OfficialLinksCard entityType="mk" externalId={mk.external_id} />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <section className="mb-8" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="mb-4 text-xl font-semibold text-neutral-900">
          נתוני כהונה
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="זמן בתפקיד"
            value={timeInOffice(role.start_date)}
            tooltip="מחושב מתאריך תחילת הכהונה (StartDate) לפי OData"
          />
          <MetricCard
            label="ממשלה"
            value={role.government_num ?? null}
            tooltip="מספר הממשלה לפי OData (GovernmentNum)"
          />
          <MetricCard
            label="כנסת"
            value={role.knesset_num ?? null}
            tooltip="מספר הכנסת לפי OData (KnessetNum)"
          />
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          מקור: Knesset OData KNS_PersonToPosition ·{" "}
          <Link href="/methodology#government-roles" className="underline">
            מתודולוגיה
          </Link>
        </p>
      </section>

      {/* Related bills */}
      {related_bills.length > 0 && (
        <section className="mb-8" aria-labelledby="bills-heading">
          <h2 id="bills-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            הצעות חוק קשורות למשרד
          </h2>
          <div className="space-y-3">
            {related_bills.map((bill) => (
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
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <BillStatusBadge status={bill.status ?? "unknown"} />
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
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
            ⚠️ הצעות חוק מסוננות לפי נושא המשרד — לא ייחוס סיבתי לשר.{" "}
            <Link href="/methodology#government-roles" className="underline">
              מתודולוגיה
            </Link>
          </div>
        </section>
      )}

      {/* Committee roles */}
      {committee_roles.length > 0 && (
        <section className="mb-8" aria-labelledby="committees-heading">
          <h2 id="committees-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            ועדות כנסת
          </h2>
          <CommitteeList committees={committee_roles} />
          <p className="mt-2 text-xs text-neutral-400">
            מקור: Knesset OData ·{" "}
            <Link href="/methodology" className="underline">
              מתודולוגיה
            </Link>
          </p>
        </section>
      )}

      {/* Back link */}
      <div className="mt-6">
        <Link
          href="/government"
          className="text-brand-600 hover:text-brand-800 text-sm hover:underline"
        >
          ← חזרה לממשלה
        </Link>
      </div>
    </div>
  );
}
