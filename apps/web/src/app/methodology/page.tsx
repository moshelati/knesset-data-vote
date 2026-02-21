import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { MetaResponse } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "מתודולוגיה ומגבלות",
  description: "הסבר מלא על שיטת החישוב, מקורות הנתונים, ומגבלות הפלטפורמה",
};

async function getMeta(): Promise<MetaResponse | null> {
  try {
    return await apiFetch<MetaResponse>("/api/meta");
  } catch {
    return null;
  }
}

export default async function MethodologyPage() {
  const meta = await getMeta();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-4xl font-bold text-neutral-900">מתודולוגיה</h1>
      <p className="mb-8 text-lg text-neutral-600">
        גרסה 1.0.0 • עדכון אחרון:{" "}
        {meta?.last_updated
          ? new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(
              new Date(meta.last_updated),
            )
          : "לא זמין"}
      </p>

      {/* Table of contents */}
      <nav className="card mb-10 p-5" aria-label="תוכן עניינים">
        <h2 className="mb-3 font-semibold text-neutral-900">תוכן עניינים</h2>
        <ul className="text-brand-600 space-y-1 text-sm">
          {[
            { href: "#overview", label: "סקירה כללית" },
            { href: "#principles", label: "עקרונות יסוד" },
            { href: "#data-sources", label: "מקורות נתונים" },
            { href: "#parties", label: "נתוני סיעות" },
            { href: "#mks", label: "נתוני חברי כנסת" },
            { href: "#government-roles", label: "נתוני ממשלה ושרים" },
            { href: "#bills", label: "נתוני הצעות חוק" },
            { href: "#topic-classification", label: "סיווג נושאים" },
            { href: "#statements", label: "הצהרות ומחויבויות" },
            { href: "#confidence", label: "רמות ביטחון" },
            { href: "#limitations", label: "מגבלות ידועות" },
            { href: "#auditability", label: "ביקורתיות ושקיפות" },
            { href: "#my-election-scoring", label: "הבחירות שלי — שיטת חישוב" },
            { href: "#my-election-limitations", label: "הבחירות שלי — מגבלות" },
          ].map(({ href, label }) => (
            <li key={href}>
              <a href={href} className="hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="prose prose-neutral max-w-none space-y-12">
        {/* Overview */}
        <section id="overview" aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="text-2xl font-bold text-neutral-900">
            סקירה כללית
          </h2>
          <p className="mt-3 leading-relaxed text-neutral-700">
            Knesset Vote הינה פלטפורמה ציבורית לניתוח נתוני כנסת ישראל. המטרה: לאפשר לבוחרים,
            עיתונאים, וחוקרים לבחון את פעילות חברי הכנסת והסיעות על בסיס נתונים פרלמנטריים מאומתים —
            ללא טענות שלא ניתן לאמת.
          </p>
        </section>

        {/* Principles */}
        <section id="principles" aria-labelledby="principles-heading">
          <h2 id="principles-heading" className="text-2xl font-bold text-neutral-900">
            עקרונות יסוד
          </h2>
          <div className="mt-4 space-y-4">
            <div className="card border-brand-500 border-r-4 p-4">
              <h3 className="font-semibold text-neutral-900">1. ללא המצאה</h3>
              <p className="mt-1 text-sm text-neutral-700">
                אנו לא מציגים שום טענה שאינה מגובה במקור נתונים רשמי. אם מידע חסר, יוצג "לא זמין
                ממקור" בלבד — לא ניחוש, לא השלמה אוטומטית.
              </p>
            </div>
            <div className="card border-brand-500 border-r-4 p-4">
              <h3 className="font-semibold text-neutral-900">2. קישור מלא למקור</h3>
              <p className="mt-1 text-sm text-neutral-700">
                כל מדד, רשימה, ופריט נתון מקושר לרשומה המקורית ב-Knesset OData API עם מזהה חיצוני
                ו-URL ניתן לאימות.
              </p>
            </div>
            <div className="card border-brand-500 border-r-4 p-4">
              <h3 className="font-semibold text-neutral-900">3. שפה ניטרלית</h3>
              <p className="mt-1 text-sm text-neutral-700">אנו משתמשים אך ורק בניסוחים ניטרליים:</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                <li>
                  <code className="rounded bg-neutral-100 px-1">
                    "Matched parliamentary activity found"
                  </code>{" "}
                  — כשיש התאמה
                </li>
                <li>
                  <code className="rounded bg-neutral-100 px-1">"Partial match"</code> — כשיש התאמה
                  חלקית
                </li>
                <li>
                  <code className="rounded bg-neutral-100 px-1">
                    "No matching parliamentary activity found as of [date]"
                  </code>{" "}
                  — כשאין התאמה
                </li>
                <li>
                  <code className="rounded bg-neutral-100 px-1">"Not available from source"</code> —
                  כשמידע חסר
                </li>
              </ul>
              <p className="mt-2 text-sm font-medium text-red-700">
                אסורים: "נכשל", "שקר", "שחיתות", "ניאש", "לא קיים את הבטחתו"
              </p>
            </div>
            <div className="card border-brand-500 border-r-4 p-4">
              <h3 className="font-semibold text-neutral-900">4. ניטרליות פוליטית</h3>
              <p className="mt-1 text-sm text-neutral-700">
                אין תיוג &quot;ימין/שמאל/מרכז&quot;. אין מתן ציון אידיאולוגי. הנתונים מוצגים כפי שהם
                מהמקור.
              </p>
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section id="data-sources" aria-labelledby="data-sources-heading">
          <h2 id="data-sources-heading" className="text-2xl font-bold text-neutral-900">
            מקורות נתונים
          </h2>
          <div className="mt-4 space-y-4">
            <div className="card p-4">
              <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  ראשי
                </span>
                Knesset OData API
              </h3>
              <p className="mt-2 text-sm text-neutral-700">
                <a
                  href="https://knesset.gov.il/Odata/ParliamentInfo.svc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  https://knesset.gov.il/Odata/ParliamentInfo.svc
                </a>
              </p>
              <p className="mt-2 text-sm text-neutral-700">
                מקור הנתונים הרשמי של הכנסת. גלויה את כל הישויות הזמינות דרך מסמך ה-$metadata. הגישה
                נעשית דרך OData v3 עם ספר-אינות ($top/$skip/nextLink).
              </p>
              {meta?.data_sources[0]?.entity_sets_discovered &&
                meta.data_sources[0].entity_sets_discovered.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-neutral-600">ישויות שהתגלו:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {meta.data_sources[0].entity_sets_discovered.map((es) => (
                        <span
                          key={es}
                          className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700"
                        >
                          {es}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </section>

        {/* Parties */}
        <section id="parties" aria-labelledby="parties-heading">
          <h2 id="parties-heading" className="text-2xl font-bold text-neutral-900">
            נתוני סיעות
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <div>
              <strong>מנדטים:</strong> מספר מנדטים כפי שמדווח בישות Faction ב-OData. אם שדה
              CountOfMembers חסר — יוצג "לא זמין ממקור".
            </div>
            <div>
              <strong>הצעות חוק שהוגשו:</strong> ספירה של כל רשומות MKBillRole שבהן role=initiator
              עבור חברי הסיעה הנוכחיים.
            </div>
            <div>
              <strong>חוקים שעברו:</strong> סינון על הצעות חוק עם status=passed. מגבלה: נתוני מצב
              חוק עשויים להיות חלקיים בכנסות קודמות.
            </div>
          </div>
        </section>

        {/* MKs */}
        <section id="mks" aria-labelledby="mks-heading">
          <h2 id="mks-heading" className="text-2xl font-bold text-neutral-900">
            נתוני חברי כנסת
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <div>
              <strong>הצעות חוק:</strong> ספירה לפי רשומות BillInitiator ב-OData עם
              IsInitiator=true.
            </div>
            <div>
              <strong>שותפות להגשה:</strong> ספירה לפי רשומות BillInitiator עם IsInitiator=false.
            </div>
            <div>
              <strong>היסטוריית סיעה:</strong> לפי ישות KnssMemberFaction עם תאריכי התחלה/סיום.
            </div>
            <div>
              <strong>חברויות בוועדות:</strong> לפי ישות CommitteeMember עם IsCurrent=true.
            </div>
            <div>
              <strong>הצבעות:</strong> לפי VoteRecord אם הישות זמינה ב-OData. ייתכן שנתונים חסרים.
            </div>
          </div>
        </section>

        {/* Government Roles */}
        <section id="government-roles" aria-labelledby="government-roles-heading">
          <h2 id="government-roles-heading" className="text-2xl font-bold text-neutral-900">
            נתוני ממשלה ושרים
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <div>
              <strong>מקור:</strong> ישות{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">KNS_PersonToPosition</code>{" "}
              מ-Knesset OData (גרסה v1:{" "}
              <a
                href="https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_PersonToPosition"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                knesset.gov.il/Odata/ParliamentInfo.svc
              </a>
              ).
            </div>
            <div>
              <strong>שדות בשימוש:</strong>{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">PositionID</code> (סינון
              לתפקידים ממשלתיים),{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">GovMinistryName</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">DutyDesc</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">StartDate</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">FinishDate</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">IsCurrent</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">GovernmentNum</code>.
            </div>
            <div>
              <strong>תפקידים מסוננים:</strong> שר (39), שרה (57), ראש הממשלה (45), משנה לרה&quot;מ
              (31), סגן רה&quot;מ (50), סגן שר (40), סגנית שר (59), מ&quot;מ רה&quot;מ (51), סגן
              שרה (285079).
            </div>
            <div>
              <strong>מיפוי נושאים:</strong> מיפוי ידני (
              <code className="rounded bg-neutral-100 px-1 font-mono">ministry-map.json</code>) בין{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono">GovMinistryID</code> לנושא
              חקיקה (כלכלה, ביטחון, חינוך וכו&#39;). זהו מיפוי ידני שעשוי להכיל שגיאות.
            </div>
            <div className="rounded-md bg-amber-50 p-3 text-amber-800">
              <strong>⚠ מגבלות חשובות:</strong>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li>
                  <strong>הצעות חוק קשורות:</strong> מסוננות לפי נושא המשרד — לא ייחוס סיבתי ישיר
                  לשר. השר לא בהכרח יזם את החוקים המוצגים.
                </li>
                <li>
                  <strong>תמונות:</strong> ייתכן שתמונות חסרות — OData אינו מספק תמונות לכל שר.
                </li>
                <li>
                  <strong>מיפוי משרדים לנושאים:</strong> ידני ועשוי שלא לשקף את כל תחומי פעילות
                  המשרד.
                </li>
                <li>
                  <strong>סגני שרים:</strong> כלולים אם רשומים ב-OData עם IsCurrent=true.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Bills */}
        <section id="bills" aria-labelledby="bills-heading">
          <h2 id="bills-heading" className="text-2xl font-bold text-neutral-900">
            נתוני הצעות חוק
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <div>
              <strong>מצב הצעת חוק:</strong> ממופה מ-StatusID ב-OData לקטגוריות: draft, submitted,
              committee_review, first_reading, second_reading, third_reading, passed, rejected,
              withdrawn, expired, unknown.
            </div>
            <div>
              <strong>היסטוריית שלבים:</strong> לפי ישות BillHistoryByStage עם StageDate.
            </div>
            <div>
              <strong>נושא:</strong> ראו סיווג נושאים להלן.
            </div>
          </div>
        </section>

        {/* Topic Classification */}
        <section id="topic-classification" aria-labelledby="topic-heading">
          <h2 id="topic-heading" className="text-2xl font-bold text-neutral-900">
            סיווג נושאים
          </h2>
          <div className="card mt-4 p-5 text-sm text-neutral-700">
            <p>
              <strong>גרסה MVP:</strong> התאמת מילות מפתח סטטיות (ראו
              packages/shared/src/constants). כל הצעת חוק מסווגת לנושא על פי נוכחות מילות מפתח בשם
              ובתיאור.
            </p>
            <p className="mt-2 font-medium text-amber-700">
              ⚠ מגבלה: סיווג זה אוטומטי ועשוי להיות שגוי. הסיווג אינו מחייב.
            </p>
            <p className="mt-2">
              <strong>גרסה עתידית:</strong> סיווג NLP על בסיס מודל שפה עברי.
            </p>
          </div>
        </section>

        {/* Statements */}
        <section id="statements" aria-labelledby="statements-heading">
          <h2 id="statements-heading" className="text-2xl font-bold text-neutral-900">
            הצהרות ומחויבויות
          </h2>
          <div className="card mt-4 space-y-2 p-5 text-sm text-neutral-700">
            <p>
              הצהרות ומחויבויות הן ציטוטים ממוקורות ציבוריים (ראיונות, נאומים, מצעים) שהוזנו ידנית
              בגרסה 1. כל הצהרה חייבת לכלול URL למקור.
            </p>
            <p>
              <strong>שפת ניטרלית:</strong> אנו משתמשים במינוח "לא נמצאה פעילות פרלמנטרית תואמת נכון
              ל-[תאריך]" בלבד. אין שימוש במינוח "הבטחה שנשברה", "כישלון", וכד'.
            </p>
            <p>
              <strong>קישור לפעילות:</strong> ניתן לקשר הצהרה להצעת חוק ספציפית עם שדה match_type
              (manual/auto_keyword) ורמת ביטחון.
            </p>
          </div>
        </section>

        {/* Confidence */}
        <section id="confidence" aria-labelledby="confidence-heading">
          <h2 id="confidence-heading" className="text-2xl font-bold text-neutral-900">
            רמות ביטחון
          </h2>
          <div className="card mt-4 p-5 text-sm text-neutral-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-2 text-right font-semibold">רמה</th>
                  <th className="pb-2 text-right font-semibold">הגדרה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="py-2 font-medium text-green-700">High confidence</td>
                  <td className="py-2">
                    קיים קישור מקור ישיר מ-Knesset OData עם external_id ו-URL
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-yellow-700">Medium confidence</td>
                  <td className="py-2">
                    נתון נגזר (ספירה, חישוב) ממקור ישיר — עשויות להיות שגיאות קטנות
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-red-600">Limited data</td>
                  <td className="py-2">נתון קיים אך אין קישור מקור ישיר, או שהנתון אפס</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-neutral-500">Not available from source</td>
                  <td className="py-2">השדה חסר לחלוטין מ-OData</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Limitations */}
        <section id="limitations" aria-labelledby="limitations-heading">
          <h2 id="limitations-heading" className="text-2xl font-bold text-neutral-900">
            מגבלות ידועות
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <p>
              <strong>שלמות נתונים:</strong> ייתכן שישויות OData מסוימות אינן זמינות או שמות שדות
              שונים מהגרסה שניסינו. הישויות מתגלות דינמית מה-$metadata.
            </p>
            <p>
              <strong>כנסות קודמות:</strong> נתוני חקיקה של כנסות קודמות עשויים להיות חסרים או
              חלקיים ב-OData.
            </p>
            <p>
              <strong>הצבעות:</strong> נתוני הצבעות אינדיבידואליות תלויים בזמינות ישות VoteRecord.
              אם אינה קיימת ב-OData, הנתון יוצג כ"לא זמין ממקור".
            </p>
            <p>
              <strong>תמונות:</strong> תמונות ח"כ אינן זמינות ב-OData ולכן מוצג אווטאר עם האות
              הראשונה של השם.
            </p>
            <p>
              <strong>תיאור חוקים:</strong> תיאורי חוקים תלויים בשדה SummaryLaw. חוקים ישנים עשויים
              להיות ללא תיאור.
            </p>
            <p>
              <strong>זמן אמת:</strong> הנתונים מתעדכנים לפי לוח זמנים של ETL ואינם מידיים. ראו
              "עדכון אחרון" בכל עמוד.
            </p>
          </div>
        </section>

        {/* Auditability */}
        <section id="auditability" aria-labelledby="audit-heading">
          <h2 id="audit-heading" className="text-2xl font-bold text-neutral-900">
            ביקורתיות ושקיפות
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <p>
              <strong>Raw Snapshots:</strong> כל fetch מה-API נשמר כ-RawSnapshot עם hash. ניתן לבקר
              כל שינוי נתון לאורך זמן.
            </p>
            <p>
              <strong>ETL Runs:</strong> כל ריצת ETL נרשמת עם timestamps, ספירות, ושגיאות. ניתן לגשת
              לסיכום דרך <code className="font-mono">/api/meta</code>.
            </p>
            <p>
              <strong>קוד פתוח:</strong> הפרויקט פתוח לביקורת. כל לוגיקת חישוב זמינה בקוד.
            </p>
            <p>
              <strong>אינדקסים:</strong> כל רשומה כוללת external_id ו-external_source לאימות מול
              המקור הרשמי.
            </p>
          </div>
        </section>

        {/* My Election — Scoring */}
        <section id="my-election-scoring" aria-labelledby="my-election-scoring-heading">
          <h2 id="my-election-scoring-heading" className="text-2xl font-bold text-neutral-900">
            הבחירות שלי — שיטת חישוב
          </h2>
          <p className="mt-3 leading-relaxed text-neutral-700">
            פיצ׳ר "הבחירות שלי" מדרג סיעות על בסיס פעילות חקיקתית בנושאים שבחרת. אין שימוש בתיוג
            פוליטי, בהצהרות, או בנתונים שאינם מרשמי הכנסת.
          </p>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <p>
              <strong>ניקוד לפי סטטוס:</strong> passed=5, second/third_reading=3,
              committee_review/first_reading=2, submitted=1, אחר=0.
            </p>
            <p>
              <strong>מכפיל לפי תפקיד:</strong> יוזם (initiator) ×1.0, שותף (cosponsor) ×0.5.
            </p>
            <p>
              <strong>ציון גולמי per סיעה/נושא:</strong>{" "}
              <code className="font-mono">Σ ניקוד_סטטוס × מכפיל_תפקיד</code> עבור כל הצ"ח.
            </p>
            <p>
              <strong>נרמול Min-Max per נושא:</strong> כל ציון מנורמל ל-0–1 יחסית לכל הסיעות
              הפעילות. סיעה עם ציון מקסימלי מקבלת 1.0.
            </p>
            <p>
              <strong>ציון אישי:</strong>{" "}
              <code className="font-mono">Σ(משקל × ציון_נושא) / Σמשקלות × 100</code>.
            </p>
            <p>
              <strong>ביטחון:</strong> ≥75% מהנושאים עם ≥2 הצ"ח = גבוה; 40–74% = בינוני; {`<`}40% =
              נמוך.
            </p>
          </div>
        </section>

        {/* My Election — Limitations */}
        <section id="my-election-limitations" aria-labelledby="my-election-limitations-heading">
          <h2 id="my-election-limitations-heading" className="text-2xl font-bold text-neutral-900">
            הבחירות שלי — מגבלות
          </h2>
          <div className="card mt-4 space-y-3 p-5 text-sm text-neutral-700">
            <p>
              <strong>אין תיוג אידאולוגי:</strong> הציונים משקפים פעילות חקיקתית בלבד — לא עמדות, לא
              ערכים, ולא השתייכות פוליטית. "ימין/שמאל" אינם חלק מהחישוב.
            </p>
            <p>
              <strong>כיסוי חלקי:</strong> חוקים שאינם מסווגים לנושא ב-OData אינם נכללים. נושאים עם
              ביטחון נמוך = פחות מ-2 הצ"ח ב-DB.
            </p>
            <p>
              <strong>שגיאות בסיווג:</strong> נושאי הצ"ח מחושבים ממילות מפתח. ייתכן שסיווג מסוים
              שגוי — בדוק תמיד במקורות הרשמיים (קישורים מצורפים לכל הצ"ח).
            </p>
            <p>
              <strong>חברות נוכחית בלבד:</strong> הציון משקלל רק חברי כנסת שהם כרגע חברים בסיעה. ח"כ
              שעבר סיעה לא יופיע בשתיהן.
            </p>
            <p>
              <strong>רעננות הנתונים:</strong> הציונים מחושבים מחדש בכל ריצת{" "}
              <code className="font-mono">pnpm etl:aggregate</code> — ולא בזמן אמת.
            </p>
          </div>
        </section>
      </div>

      {/* ETL info */}
      {meta?.etl_summary && (
        <div className="card mt-12 p-5 text-sm text-neutral-700">
          <h2 className="mb-3 font-semibold text-neutral-900">מצב ETL אחרון</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">מזהה ריצה</dt>
              <dd className="font-mono text-xs">{meta.etl_summary.last_run_id}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">סטטוס</dt>
              <dd>
                <span
                  className={`font-medium ${
                    meta.etl_summary.status === "completed"
                      ? "text-green-700"
                      : meta.etl_summary.status === "failed"
                        ? "text-red-600"
                        : "text-yellow-700"
                  }`}
                >
                  {meta.etl_summary.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">התחיל</dt>
              <dd>{new Date(meta.etl_summary.started_at).toLocaleString("he-IL")}</dd>
            </div>
            {meta.etl_summary.completed_at && (
              <div>
                <dt className="text-neutral-500">הסתיים</dt>
                <dd>{new Date(meta.etl_summary.completed_at).toLocaleString("he-IL")}</dd>
              </div>
            )}
          </dl>
          {meta.etl_summary.errors.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-neutral-700">שגיאות:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-red-600">
                {meta.etl_summary.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-center text-sm text-neutral-500">
        <Link href="/" className="text-brand-600 hover:underline">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
