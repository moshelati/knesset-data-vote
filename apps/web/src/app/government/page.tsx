import type { Metadata } from "next";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { MinisterCard } from "@/components/government/MinisterCard";
import { AdSlot } from "@/components/shared/AdSlot";
import type { GovernmentMinister } from "@knesset-vote/shared";

export const metadata: Metadata = {
  title: "ממשלת ישראל",
  description: "שרי הממשלה הנוכחית, משרדיהם, וזמן כהונתם — נתונים מ-Knesset OData",
};

interface GovernmentResponse {
  data: GovernmentMinister[];
  total: number;
  methodology_url: string;
}

async function getMinisters(): Promise<GovernmentResponse | null> {
  try {
    return await apiFetch<GovernmentResponse>("/api/government");
  } catch {
    return null;
  }
}

export default async function GovernmentPage() {
  const response = await getMinisters();
  const ministers = response?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">הממשלה</h1>
        <p className="mt-2 text-neutral-600">
          {ministers.length > 0
            ? `${ministers.length} שרים ומשנים · ממשלה 37 · כנסת 25 · נתונים מ-Knesset OData`
            : "טוען נתונים…"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/methodology#government-roles"
            className="text-brand-600 hover:text-brand-800 underline"
          >
            שיטת החישוב ומגבלות ↗
          </Link>
          <span className="text-neutral-300">|</span>
          <a
            href="https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_PersonToPosition"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 underline hover:text-neutral-700"
          >
            מקור: Knesset OData ↗
          </a>
        </div>
      </div>

      {ministers.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">לא נמצאו שרים.</p>
          <p className="mt-2 text-sm text-neutral-400">
            הפעל <code className="font-mono">pnpm etl:sync</code> לטעינת נתוני השרים
          </p>
        </div>
      ) : (
        <>
          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST} className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ministers.map((minister) => (
              <MinisterCard key={minister.mk.id} minister={minister} />
            ))}
          </div>
          {/* Methodology disclaimer */}
          <div className="mt-8 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">⚠️ הערה מתודולוגית</p>
            <p className="mt-1">
              הצעות החוק הקשורות מסוננות לפי נושא המשרד — לא ייחוס סיבתי ישיר לשר. ראו{" "}
              <Link href="/methodology#government-roles" className="underline">
                מתודולוגיה
              </Link>{" "}
              לפירוט מלא.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
