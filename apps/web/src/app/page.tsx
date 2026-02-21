import { Suspense } from "react";
import Link from "next/link";
import { Search, ExternalLink, RefreshCcw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { MetaResponse } from "@knesset-vote/shared";

async function getMetaData() {
  try {
    return await apiFetch<MetaResponse>("/api/meta");
  } catch {
    return null;
  }
}

async function getStats() {
  try {
    const [parties, mks, bills] = await Promise.all([
      apiFetch<{ total: number }>("/api/parties"),
      apiFetch<{ total: number }>("/api/mks"),
      apiFetch<{ total: number }>("/api/bills"),
    ]);
    return {
      parties: parties.total,
      mks: mks.total,
      bills: bills.total,
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [meta, stats] = await Promise.all([getMetaData(), getStats()]);

  const isDemo =
    !meta?.last_updated ||
    meta?.etl_summary?.status === "failed" ||
    !stats ||
    (stats.parties === 0 && stats.mks === 0);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="from-brand-700 to-brand-900 bg-gradient-to-br px-4 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">הצביעו עם נתונים</h1>
          <p className="text-brand-100 mb-8 text-xl">
            מידע פרלמנטרי מאומת ממקורות רשמיים — ללא טענות שלא ניתן לאמת.
          </p>

          {/* Search */}
          <form action="/search" method="get" className="mx-auto max-w-2xl">
            <div className="flex rounded-xl bg-white shadow-lg">
              <label htmlFor="search-input" className="sr-only">
                חיפוש חבר כנסת, סיעה או הצעת חוק
              </label>
              <input
                id="search-input"
                type="text"
                name="q"
                placeholder="חפשו חבר כנסת, סיעה, או הצעת חוק..."
                className="flex-1 rounded-r-xl px-6 py-4 text-lg text-neutral-900 focus:outline-none"
                aria-label="חיפוש"
              />
              <button
                type="submit"
                className="bg-brand-500 hover:bg-brand-600 flex items-center gap-2 rounded-l-xl px-6 py-4 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="חפש"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </form>

          {/* Last updated */}
          {meta?.last_updated && (
            <p className="text-brand-200 mt-4 flex items-center justify-center gap-1 text-sm">
              <RefreshCcw className="h-3 w-3" aria-hidden="true" />
              עדכון אחרון:{" "}
              {new Intl.DateTimeFormat("he-IL", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(meta.last_updated))}
            </p>
          )}
        </div>
      </section>

      {/* Demo warning */}
      {isDemo && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          <strong>מצב הדגמה:</strong> הנתונים המוצגים הם לדוגמה בלבד ואינם ממקור רשמי. הפעל{" "}
          <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני הכנסת הרשמיים.
        </div>
      )}

      {/* Stats */}
      <section className="border-b border-neutral-200 bg-white px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-brand-700 text-3xl font-bold">
                {stats ? stats.parties.toLocaleString("he-IL") : "—"}
              </div>
              <div className="mt-1 text-sm text-neutral-600">סיעות</div>
            </div>
            <div>
              <div className="text-brand-700 text-3xl font-bold">
                {stats ? stats.mks.toLocaleString("he-IL") : "—"}
              </div>
              <div className="mt-1 text-sm text-neutral-600">חברי כנסת</div>
            </div>
            <div>
              <div className="text-brand-700 text-3xl font-bold">
                {stats ? stats.bills.toLocaleString("he-IL") : "—"}
              </div>
              <div className="mt-1 text-sm text-neutral-600">הצעות חוק</div>
            </div>
          </div>
        </div>
      </section>

      {/* Browse sections */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 text-2xl font-bold text-neutral-900">עיינו בנתונים</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                href: "/parties",
                title: "סיעות",
                description:
                  "עיינו בסיעות הכנסת, חבריהן, ופעילות החקיקה שלהן על פי נתוני OData רשמיים.",
                icon: "🏛",
                ariaLabel: "עיין בסיעות הכנסת",
              },
              {
                href: "/mks",
                title: "חברי כנסת",
                description:
                  "פרופיל, ניידות בין סיעות, הצעות חוק שהגישו, ומדדי פעילות לפי נתונים רשמיים.",
                icon: "👤",
                ariaLabel: "עיין בחברי הכנסת",
              },
              {
                href: "/bills",
                title: "הצעות חוק",
                description: "עיינו בהצעות חוק לפי נושא, מצב, ומגישים. קישורים למקורות לכל רשומה.",
                icon: "📜",
                ariaLabel: "עיין בהצעות חוק",
              },
            ].map(({ href, title, description, icon, ariaLabel }) => (
              <Link
                key={href}
                href={href}
                className="card group p-6 transition-shadow hover:shadow-md"
                aria-label={ariaLabel}
              >
                <div className="mb-3 text-3xl">{icon}</div>
                <h3 className="group-hover:text-brand-700 mb-2 text-lg font-semibold text-neutral-900">
                  {title}
                </h3>
                <p className="text-sm text-neutral-600">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency pledge */}
      <section className="bg-neutral-50 px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-neutral-900">מחויבות לשקיפות</h2>
          <div className="grid gap-4 text-sm text-neutral-700 sm:grid-cols-3">
            <div className="card p-4">
              <div className="mb-2 text-2xl">📎</div>
              <strong>מקור לכל טענה</strong>
              <br />
              כל מדד מקושר למקור הנתונים הרשמי
            </div>
            <div className="card p-4">
              <div className="mb-2 text-2xl">🚫</div>
              <strong>ללא המצאה</strong>
              <br />
              אם מידע חסר, מוצג "לא זמין ממקור" בלבד
            </div>
            <div className="card p-4">
              <div className="mb-2 text-2xl">⚖️</div>
              <strong>שפה ניטרלית</strong>
              <br />
              ללא ניסוח מוטה, ללא שיפוטיות אישית
            </div>
          </div>
          <Link
            href="/methodology"
            className="text-brand-600 mt-6 inline-flex items-center gap-2 text-sm hover:underline"
          >
            קראו על המתודולוגיה שלנו
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Data source info */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="card p-6">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">מקורות נתונים</h2>
            <div className="space-y-2 text-sm text-neutral-700">
              <div className="flex items-start gap-2">
                <span className="text-green-600">●</span>
                <div>
                  <strong>ראשי:</strong>{" "}
                  <a
                    href="https://knesset.gov.il/Odata/ParliamentInfo.svc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Knesset OData API ↗
                  </a>{" "}
                  — נתוני כנסת ישראל הרשמיים
                </div>
              </div>
              {meta?.data_sources[0]?.entity_sets_discovered &&
                meta.data_sources[0].entity_sets_discovered.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-500">
                    ישויות שהתגלו מ-OData: {meta.data_sources[0].entity_sets_discovered.join(", ")}
                  </div>
                )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
