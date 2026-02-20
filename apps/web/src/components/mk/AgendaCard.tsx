import type { MKProfile, MKTopicBreakdownItem } from "@knesset-vote/shared";

interface Props {
  profile: MKProfile;
  topTopics: MKTopicBreakdownItem[];
  name_he: string;
  is_current: boolean;
}

function formatYear(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).getFullYear().toString();
}

export function AgendaCard({ profile, topTopics, name_he, is_current }: Props) {
  const firstYear = formatYear(profile.first_elected);
  const termsList = profile.knesset_terms.length > 0 ? profile.knesset_terms.join(", ") : null;
  const top3Topics = topTopics.slice(0, 3).map((t) => t.label_he);

  // Nothing meaningful to show
  if (!firstYear && top3Topics.length === 0 && profile.knesset_terms.length === 0) {
    return null;
  }

  // Determine title based on gender
  const titleHe =
    profile.gender === "female"
      ? "חברת כנסת"
      : profile.gender === "male"
        ? "חבר כנסת"
        : "חבר/ת כנסת";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h3 className="mb-3 text-sm font-semibold text-amber-900">📋 פרופיל וניסיון</h3>

      <div className="space-y-2 text-sm text-amber-800">
        {/* Career span */}
        {firstYear && (
          <p>
            <span className="font-medium">{titleHe}</span> {is_current ? "מאז" : "שכיה/ה בין שנת"}{" "}
            {firstYear}
            {termsList && <span> · כנסות: {termsList}</span>}
          </p>
        )}

        {/* Top legislative topics */}
        {top3Topics.length > 0 && (
          <p>
            <span className="font-medium">תחומי חקיקה עיקריים:</span> {top3Topics.join(" · ")}
          </p>
        )}

        {/* Gender info */}
        {profile.gender !== "unknown" && (
          <p>
            <span className="font-medium">מגדר:</span> {profile.gender_label_he}
          </p>
        )}
      </div>

      {/* Mandatory disclaimer */}
      <p className="mt-3 border-t border-amber-200 pt-2 text-xs text-amber-600">
        ⚠️ נוצר אוטומטית מנתוני חקיקה ב-Knesset OData — אינו ביוגרפיה רשמית ואינו מייצג עמדה
        פוליטית. אין המצאה של מידע. כל הנתונים ממקורות רשמיים בלבד.
      </p>
    </div>
  );
}
