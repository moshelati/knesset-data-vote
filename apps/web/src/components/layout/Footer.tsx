import Link from "next/link";
import { apiFetch } from "@/lib/api";

async function getLastUpdated() {
  try {
    const meta = await apiFetch<{ last_updated: string | null }>("/api/meta");
    return meta.last_updated;
  } catch {
    return null;
  }
}

export async function Footer() {
  const lastUpdated = await getLastUpdated();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* About */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Knesset Vote</h3>
            <p className="text-sm text-neutral-600">
              פלטפורמה שקופה להערכת כנסת ישראל. כל הנתונים ממקורות רשמיים בלבד.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">ניווט</h3>
            <ul className="space-y-2">
              {[
                { href: "/parties", label: "סיעות" },
                { href: "/mks", label: "חברי כנסת" },
                { href: "/bills", label: "הצעות חוק" },
                { href: "/methodology", label: "מתודולוגיה ומגבלות" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-brand-700 text-sm text-neutral-600">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Data sources */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">מקורות נתונים</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://knesset.gov.il/Odata/ParliamentInfo.svc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-800 text-sm"
                >
                  Knesset OData API ↗
                </a>
              </li>
              <li>
                <Link href="/methodology" className="hover:text-brand-700 text-sm text-neutral-600">
                  שיטת חישוב ומגבלות
                </Link>
              </li>
            </ul>
            {lastUpdated && (
              <p className="mt-3 text-xs text-neutral-500">
                עדכון אחרון:{" "}
                {new Intl.DateTimeFormat("he-IL", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(lastUpdated))}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-2 border-t border-neutral-200 pt-6">
          {/* Primary disclaimer */}
          <p className="text-center text-xs font-medium text-neutral-600">
            ⚠️ מיזם עצמאי — אינו אתר רשמי של הכנסת ואינו קשור אליה.{" "}
            <a
              href="https://www.knesset.gov.il"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-800 underline"
            >
              לאתר הכנסת הרשמי ↗
            </a>
          </p>
          {/* Data disclaimer */}
          <p className="text-center text-xs text-neutral-400">
            כל הנתונים מקורם ב-Knesset OData API בלבד. אין המצאה של טענות ואין מניפולציה של נתונים.
            ראו{" "}
            <Link href="/methodology" className="hover:text-brand-700 underline">
              מתודולוגיה ומגבלות
            </Link>{" "}
            לפירוט. האתר אינו מביע עמדה פוליטית.
          </p>
        </div>
      </div>
    </footer>
  );
}
