import { ExternalLink } from "lucide-react";
import { mkOfficialUrl, billOfficialUrl, factionOfficialUrl } from "@/lib/knesset-urls";

type EntityType = "mk" | "bill" | "party";

interface OfficialLinksCardProps {
  entityType: EntityType;
  externalId: string | number | null | undefined;
  /** Optional label override (defaults to entity-specific label) */
  label?: string;
}

const DEFAULT_LABELS: Record<EntityType, string> = {
  mk: "דף חבר/ת הכנסת באתר הרשמי",
  bill: "הצעת החוק באתר הרשמי",
  party: "דף הסיעה באתר הרשמי",
};

function buildUrl(
  entityType: EntityType,
  externalId: string | number | null | undefined,
): string | null {
  switch (entityType) {
    case "mk":
      return mkOfficialUrl(externalId);
    case "bill":
      return billOfficialUrl(externalId);
    case "party":
      return factionOfficialUrl(externalId);
  }
}

/**
 * OfficialLinksCard — renders a deep-link to the official Knesset website
 * for a given MK, bill, or party (faction).
 *
 * Shows nothing if externalId is missing.
 */
export function OfficialLinksCard({ entityType, externalId, label }: OfficialLinksCardProps) {
  const url = buildUrl(entityType, externalId);
  if (!url) return null;

  const displayLabel = label ?? DEFAULT_LABELS[entityType];

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        מקור רשמי
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-700 hover:text-brand-900 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        aria-label={`${displayLabel} — נפתח בחלון חדש`}
      >
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        {displayLabel}
      </a>
      <p className="mt-1 text-xs text-neutral-400">
        אתר הכנסת הרשמי — מידע עדכני עשוי להיות שונה ממה שמוצג כאן
      </p>
    </div>
  );
}
