import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Vote, VoteRecord } from "@knesset-vote/shared";

interface VoteDetailResponse {
  data: {
    vote: Vote;
    records: VoteRecord[];
  };
}

async function getVote(id: string): Promise<{ vote: Vote; records: VoteRecord[] } | null> {
  try {
    const res = await apiFetch<VoteDetailResponse>(`/api/votes/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await getVote(params.id);
  if (!data) return { title: "הצבעה לא נמצאה" };
  return {
    title: data.vote.title_he,
    description: `הצבעה במליאה: ${data.vote.title_he}`,
  };
}

function VoteResultBadge({ result }: { result: string | null }) {
  if (!result || result === "unknown") {
    return <span className="badge bg-neutral-100 text-neutral-600 text-base px-3 py-1">לא ידוע</span>;
  }
  if (result === "passed") {
    return <span className="badge badge-passed text-base px-3 py-1">עבר ✓</span>;
  }
  return <span className="badge badge-rejected text-base px-3 py-1">נדחה ✗</span>;
}

function PositionBadge({ position }: { position: string }) {
  switch (position) {
    case "yes":
      return <span className="badge bg-green-100 text-green-700 text-xs">בעד</span>;
    case "no":
      return <span className="badge bg-red-100 text-red-700 text-xs">נגד</span>;
    case "abstain":
      return <span className="badge bg-neutral-100 text-neutral-600 text-xs">נמנע</span>;
    default:
      return <span className="badge bg-neutral-50 text-neutral-400 text-xs">לא הצביע</span>;
  }
}

function VoteBar({
  yes,
  no,
  abstain,
}: {
  yes: number | null;
  no: number | null;
  abstain: number | null;
}) {
  const total = (yes ?? 0) + (no ?? 0) + (abstain ?? 0);
  if (total === 0) return null;

  const yesPct = ((yes ?? 0) / total) * 100;
  const noPct = ((no ?? 0) / total) * 100;
  const abstainPct = ((abstain ?? 0) / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex h-5 w-full overflow-hidden rounded-lg" aria-hidden="true">
        <div
          className="flex items-center justify-center bg-green-500 text-[10px] font-bold text-white transition-all"
          style={{ width: `${yesPct}%` }}
        >
          {yesPct > 8 ? `${Math.round(yesPct)}%` : ""}
        </div>
        <div
          className="flex items-center justify-center bg-red-500 text-[10px] font-bold text-white transition-all"
          style={{ width: `${noPct}%` }}
        >
          {noPct > 8 ? `${Math.round(noPct)}%` : ""}
        </div>
        <div
          className="flex items-center justify-center bg-neutral-400 text-[10px] font-bold text-white transition-all"
          style={{ width: `${abstainPct}%` }}
        >
          {abstainPct > 8 ? `${Math.round(abstainPct)}%` : ""}
        </div>
      </div>
      <div className="flex justify-between text-xs text-neutral-500">
        <span className="text-green-600">בעד: {yes ?? 0}</span>
        <span className="text-red-600">נגד: {no ?? 0}</span>
        <span className="text-neutral-400">נמנע: {abstain ?? 0}</span>
      </div>
    </div>
  );
}

function groupByPosition(records: VoteRecord[]) {
  return {
    yes: records.filter((r) => r.position === "yes"),
    no: records.filter((r) => r.position === "no"),
    abstain: records.filter((r) => r.position === "abstain"),
    other: records.filter((r) => r.position !== "yes" && r.position !== "no" && r.position !== "abstain"),
  };
}

export default async function VotePage({ params }: { params: { id: string } }) {
  const data = await getVote(params.id);
  if (!data) notFound();

  const { vote, records } = data;
  const grouped = groupByPosition(records);
  const hasRecords = records.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/votes"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand-700"
      >
        ← חזרה לרשימת הצבעות
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-neutral-900 flex-1">{vote.title_he}</h1>
          <VoteResultBadge result={vote.result} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-600">
          {vote.knesset_number && <span>כנסת {vote.knesset_number}</span>}
          {vote.vote_date && <span>{formatDate(vote.vote_date)}</span>}
          {vote.topic && <span className="badge bg-blue-50 text-blue-700">{vote.topic}</span>}
        </div>

        {vote.source_url && (
          <a
            href={vote.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            צפה במקור
          </a>
        )}
      </div>

      {/* Vote counts bar */}
      {(vote.yes_count != null || vote.no_count != null) && (
        <section className="mb-8 card p-5" aria-labelledby="counts-heading">
          <h2 id="counts-heading" className="mb-3 text-lg font-semibold text-neutral-900">
            תוצאת ההצבעה
          </h2>
          <VoteBar yes={vote.yes_count} no={vote.no_count} abstain={vote.abstain_count} />
        </section>
      )}

      {/* MK breakdown */}
      {hasRecords ? (
        <section aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="mb-4 text-xl font-semibold text-neutral-900">
            עמדות חברי הכנסת
            <span className="mr-2 text-sm font-normal text-neutral-500">
              ({records.length} ח"כים)
            </span>
          </h2>

          <div className="space-y-6">
            {/* Yes */}
            {grouped.yes.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-green-700">
                  <span className="inline-block h-3 w-3 rounded-full bg-green-500" aria-hidden="true" />
                  בעד — {grouped.yes.length} ח"כים
                </h3>
                <div className="flex flex-wrap gap-2">
                  {grouped.yes.map((r) => (
                    <Link
                      key={r.mk_id}
                      href={`/mks/${r.mk_id}`}
                      className="card inline-flex items-center gap-1.5 px-3 py-1.5 text-sm hover:shadow-md"
                    >
                      <span className="font-medium text-neutral-900">{r.mk_name_he}</span>
                      <PositionBadge position={r.position} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No */}
            {grouped.no.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-red-700">
                  <span className="inline-block h-3 w-3 rounded-full bg-red-500" aria-hidden="true" />
                  נגד — {grouped.no.length} ח"כים
                </h3>
                <div className="flex flex-wrap gap-2">
                  {grouped.no.map((r) => (
                    <Link
                      key={r.mk_id}
                      href={`/mks/${r.mk_id}`}
                      className="card inline-flex items-center gap-1.5 px-3 py-1.5 text-sm hover:shadow-md"
                    >
                      <span className="font-medium text-neutral-900">{r.mk_name_he}</span>
                      <PositionBadge position={r.position} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Abstain */}
            {grouped.abstain.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-neutral-600">
                  <span className="inline-block h-3 w-3 rounded-full bg-neutral-400" aria-hidden="true" />
                  נמנע — {grouped.abstain.length} ח"כים
                </h3>
                <div className="flex flex-wrap gap-2">
                  {grouped.abstain.map((r) => (
                    <Link
                      key={r.mk_id}
                      href={`/mks/${r.mk_id}`}
                      className="card inline-flex items-center gap-1.5 px-3 py-1.5 text-sm hover:shadow-md"
                    >
                      <span className="font-medium text-neutral-900">{r.mk_name_he}</span>
                      <PositionBadge position={r.position} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Did not vote */}
            {grouped.other.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-400">
                  <span className="inline-block h-3 w-3 rounded-full bg-neutral-200" aria-hidden="true" />
                  לא הצביע/ה — {grouped.other.length} ח"כים
                </h3>
                <div className="flex flex-wrap gap-2">
                  {grouped.other.map((r) => (
                    <Link
                      key={r.mk_id}
                      href={`/mks/${r.mk_id}`}
                      className="card inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:shadow-md"
                    >
                      {r.mk_name_he}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-xs text-neutral-400">
            מקור: Knesset OData v4 —{" "}
            <Link href="/methodology#votes" className="underline">
              מתודולוגיה
            </Link>
          </p>
        </section>
      ) : (
        <div className="card p-8 text-center text-neutral-500">
          <p>פרטי הצבעה פרטנית עדיין לא נטענו</p>
          <p className="mt-1 text-sm text-neutral-400">הנתונים ייטענו לאחר השלמת ה-ETL</p>
        </div>
      )}
    </div>
  );
}
