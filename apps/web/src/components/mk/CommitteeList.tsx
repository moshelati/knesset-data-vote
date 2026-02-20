import type { MKCommitteeListItem } from "@knesset-vote/shared";

interface Props {
  committees: MKCommitteeListItem[];
}

const ROLE_LABELS: Record<string, string> = {
  chairman: 'יו"ר',
  deputy_chairman: 'סגן יו"ר',
  member: "חבר/ת",
  observer: "משקיף/ה",
  substitute: "ממלא/ת מקום",
};

function roleLabel(role: string | null): string {
  if (!role) return "חבר/ת";
  return ROLE_LABELS[role.toLowerCase()] ?? role;
}

export function CommitteeList({ committees }: Props) {
  if (committees.length === 0) {
    return <p className="text-sm text-neutral-500">אין חברות בוועדות</p>;
  }

  const current = committees.filter((c) => c.is_current);
  const past = committees.filter((c) => !c.is_current);

  return (
    <div className="space-y-4">
      {current.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            ועדות נוכחיות
          </h3>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {current.map((c) => (
              <li
                key={c.committee_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex-1">
                  <span className="text-sm font-medium text-neutral-800">{c.name_he}</span>
                  {c.knesset_number && (
                    <span className="mr-2 text-xs text-neutral-400">כנסת {c.knesset_number}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="badge bg-neutral-100 text-xs text-neutral-600">
                    {roleLabel(c.role)}
                  </span>
                  <span className="badge bg-green-100 text-xs text-green-800">נוכחי</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-xs font-medium text-neutral-500 hover:text-neutral-700">
            ▸ ועדות לשעבר ({past.length})
          </summary>
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {past.map((c) => (
              <li
                key={`${c.committee_id}-past`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex-1">
                  <span className="text-sm text-neutral-700">{c.name_he}</span>
                  {c.knesset_number && (
                    <span className="mr-2 text-xs text-neutral-400">כנסת {c.knesset_number}</span>
                  )}
                </div>
                <span className="badge badge-unknown shrink-0 text-xs">{roleLabel(c.role)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
