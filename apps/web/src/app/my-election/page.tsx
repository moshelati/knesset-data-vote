import type { Metadata } from "next";
import Link from "next/link";
import { WizardClient } from "./WizardClient";

export const metadata: Metadata = {
  title: "הבחירות שלי | Knesset Vote",
  description:
    "גלה אילו סיעות פעלו בנושאים החשובים לך — על בסיס נתוני חקיקה בלבד, ללא תיוג פוליטי",
};

export default function MyElectionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">הבחירות שלי</h1>
        <p className="mt-2 text-neutral-600">
          בחר נושאים לפי חשיבותם וגלה אילו סיעות פעלו בתחומים אלה על בסיס
          פעילות חקיקתית בלבד.
        </p>
        <p className="mt-1 text-sm text-neutral-400">
          הציונים מבוססים אך ורק על נתוני הצעות חוק מרשמי הכנסת. אין תיוג
          אידאולוגי.{" "}
          <Link href="/methodology#my-election-scoring" className="text-brand-600 hover:underline">
            למד עוד על השיטה
          </Link>
        </p>
      </div>

      {/* Wizard */}
      <WizardClient />
    </div>
  );
}
