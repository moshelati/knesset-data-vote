import Link from "next/link";
import Image from "next/image";
import type { GovernmentMinister } from "@knesset-vote/shared";
import { BillStatusBadge } from "@/components/shared/BillStatusBadge";
import { formatDateShort } from "@/lib/utils";

interface MinisterCardProps {
  minister: GovernmentMinister;
}

/** Compute years + months in office from start_date to now */
function timeInOffice(startDate: string | null): string {
  if (!startDate) return "—";
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  if (diffMs <= 0) return "—";
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} חודשים`;
  if (months === 0) return `${years} שנים`;
  return `${years} שנ' ${months} חוד'`;
}

export function MinisterCard({ minister }: MinisterCardProps) {
  const { mk, role, related_bills } = minister;

  const displayName = role.duty_desc ?? mk.name_he;
  const isPM = role.position_id === 45;

  return (
    <Link
      href={`/government/${mk.id}`}
      className="card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-md"
      aria-label={`פרופיל ${displayName}`}
    >
      {/* Header: avatar + name + ministry */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0" aria-hidden="true">
          {mk.image_url ? (
            <Image
              src={mk.image_url}
              alt={mk.name_he}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${
                isPM ? "bg-purple-100 text-purple-700" : "bg-brand-100 text-brand-700"
              }`}
            >
              {mk.name_he.charAt(0)}
            </div>
          )}
        </div>

        {/* Name + role */}
        <div className="min-w-0 flex-1">
          <p className="group-hover:text-brand-700 truncate font-semibold text-neutral-900">
            {mk.name_he}
          </p>
          {role.duty_desc && role.duty_desc !== mk.name_he && (
            <p className="truncate text-xs text-neutral-500">{role.duty_desc}</p>
          )}
          {isPM && (
            <span className="mt-0.5 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
              ראש הממשלה
            </span>
          )}
        </div>
      </div>

      {/* Ministry badge */}
      {role.ministry_name && (
        <div>
          <span className="inline-block rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
            {role.ministry_name}
          </span>
        </div>
      )}

      {/* Time in office */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span>בתפקיד:</span>
        <span className="font-medium text-neutral-700">{timeInOffice(role.start_date)}</span>
        {role.start_date && (
          <span className="text-neutral-400">(מאז {formatDateShort(role.start_date)})</span>
        )}
      </div>

      {/* Related bills */}
      {related_bills.length > 0 && (
        <div className="border-t border-neutral-100 pt-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            הצעות חוק קשורות
          </p>
          <ul className="space-y-1.5">
            {related_bills.map((bill) => (
              <li key={bill.id} className="flex items-start gap-2">
                <BillStatusBadge status={bill.status ?? "unknown"} />
                <span className="line-clamp-2 text-xs text-neutral-700">{bill.title_he}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Link>
  );
}
