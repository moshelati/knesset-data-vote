import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "מדיניות פרטיות",
  description: "מדיניות הפרטיות של Knesset Vote — שימוש בנתונים, עוגיות ופרסומות",
};

export default function PrivacyPage() {
  const lastUpdated = "פברואר 2026";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-neutral-900">מדיניות פרטיות</h1>
      <p className="mb-8 text-sm text-neutral-500">עדכון אחרון: {lastUpdated}</p>

      <div className="space-y-8 text-neutral-700">
        {/* Overview */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">כללי</h2>
          <p className="leading-relaxed">
            Knesset Vote הינה פלטפורמה ציבורית המציגה נתוני כנסת ישראל ממקורות רשמיים בלבד. אנו
            מחויבים לשמירה על פרטיותכם. דף זה מסביר אילו נתונים נאספים, כיצד הם משמשים, ומה הן
            זכויותיכם.
          </p>
        </section>

        {/* Data Collected */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">נתונים הנאספים</h2>
          <div className="card space-y-4 p-5 text-sm">
            <div>
              <h3 className="font-semibold text-neutral-900">נתוני שימוש אנונימיים</h3>
              <p className="mt-1">
                ייתכן שנאסף מידע טכני אנונימי כגון סוג הדפדפן, מערכת ההפעלה, עמודים שנצפו, וזמן
                שהייה. מידע זה אינו מזהה אותך אישית.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">נתוני עוגיות (Cookies)</h3>
              <p className="mt-1">
                האתר משתמש בעוגיות לצרכי פרסום (Google AdSense) וניתוח תנועה. ניתן לנהל הגדרות
                עוגיות דרך הדפדפן שלך.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">לא נאסף מידע אישי ישיר</h3>
              <p className="mt-1">
                אנו לא אוספים שם, כתובת דוא"ל, מספר טלפון, או כל פרט מזהה אחר ישירות ממשתמשים. האתר
                אינו מצריך הרשמה.
              </p>
            </div>
          </div>
        </section>

        {/* Advertising */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">פרסומות — Google AdSense</h2>
          <div className="card space-y-4 p-5 text-sm">
            <p>
              אתר זה משתמש ב-<strong>Google AdSense</strong> להצגת פרסומות. Google עשויה להשתמש
              בעוגיות לצורך הצגת מודעות מותאמות אישית בהתבסס על ביקורים קודמים שלך באתר זה ובאתרים
              אחרים.
            </p>
            <p>
              Google AdSense משתמשת ב-DART cookie כדי להציג מודעות למשתמשים בהתבסס על ביקורים באתרים
              שונים. ניתן לבטל שימוש ב-DART cookie דרך{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                מדיניות הפרסום של Google ↗
              </a>
              .
            </p>
            <p>
              לבקרה על פרסומות מותאמות אישית, בקרו ב-{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                הגדרות מודעות Google ↗
              </a>
              .
            </p>
            <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
              <strong>שקיפות:</strong> הכנסות מפרסומות מסייעות לממן את תפעול האתר ואת עלויות
              הנתונים. האתר אינו מציג פרסומות מפלגתיות או תוכן שיווקי פוליטי.
            </div>
          </div>
        </section>

        {/* Third Party */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">שירותי צד שלישי</h2>
          <div className="card space-y-3 p-5 text-sm">
            <div>
              <strong>Knesset OData API:</strong> כל נתוני הכנסת מגיעים ממקור ציבורי זה. הגישה
              לנתונים כפופה ל{" "}
              <a
                href="https://www.knesset.gov.il/description/heb/heb_aboutsite.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                תנאי השימוש של אתר הכנסת ↗
              </a>
              .
            </div>
            <div>
              <strong>Google Fonts:</strong> גופנים נטענים מ-Google Fonts. Google עשויה לאסוף נתוני
              שימוש בסיסיים.
            </div>
          </div>
        </section>

        {/* Your Rights */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">זכויותיך</h2>
          <div className="card space-y-3 p-5 text-sm">
            <p>
              <strong>ניהול עוגיות:</strong> ניתן לחסום או למחוק עוגיות דרך הגדרות הדפדפן שלך. שים
              לב שחסימת כל העוגיות עלולה להשפיע על תפקוד חלק מהעמודים.
            </p>
            <p>
              <strong>אי-קבלת פרסומות מותאמות:</strong> ניתן לבטל פרסומות מותאמות דרך{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                aboutads.info ↗
              </a>{" "}
              או{" "}
              <a
                href="https://www.youronlinechoices.eu/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                youronlinechoices.eu ↗
              </a>
              .
            </p>
          </div>
        </section>

        {/* Changes */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">שינויים במדיניות</h2>
          <p className="text-sm leading-relaxed">
            מדיניות זו עשויה להתעדכן מעת לעת. שינויים מהותיים יצוינו בתאריך העדכון האחרון בראש הדף.
            המשך השימוש באתר לאחר שינויים מהווה הסכמה לתנאים המעודכנים.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">יצירת קשר</h2>
          <p className="text-sm leading-relaxed">
            לשאלות בנוגע למדיניות הפרטיות, ניתן לפנות דרך{" "}
            <a
              href="https://github.com/moshelati/knesset-data-vote"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              GitHub ↗
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-6 text-center text-sm text-neutral-500">
        <Link href="/" className="text-brand-600 hover:underline">
          חזרה לדף הבית
        </Link>
        {" · "}
        <Link href="/methodology" className="text-brand-600 hover:underline">
          מתודולוגיה
        </Link>
      </div>
    </div>
  );
}
