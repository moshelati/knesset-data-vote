import Link from "next/link";
import { Info } from "lucide-react";

/**
 * GovBar — top-of-page disclaimer strip.
 * Clarifies this is an independent project, not an official Knesset site.
 * Rendered above <Header> in the root layout.
 */
export function GovBar() {
  return (
    <div
      className="bg-brand-800 text-white"
      role="banner"
      aria-label="הצהרת אתר עצמאי"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 sm:px-6 lg:px-8">
        {/* Left: disclaimer */}
        <div className="flex items-center gap-2 text-xs text-brand-100">
          <Info className="h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-white">מיזם עצמאי</strong>
            {" — "}אינו אתר רשמי של הכנסת. כל הנתונים ממקור{" "}
            <a
              href="https://knesset.gov.il/Odata/ParliamentInfo.svc"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-brand-400 hover:text-white"
            >
              Knesset OData
            </a>{" "}
            בלבד.{" "}
            <Link href="/methodology" className="underline decoration-brand-400 hover:text-white">
              מתודולוגיה ↗
            </Link>
          </span>
        </div>

        {/* Right: official Knesset link */}
        <a
          href="https://www.knesset.gov.il"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 items-center gap-1 rounded bg-brand-700 px-2 py-0.5 text-xs text-brand-100 hover:bg-brand-600 hover:text-white sm:flex"
          aria-label="עבור לאתר הכנסת הרשמי (נפתח בחלון חדש)"
        >
          אתר כנסת רשמי ↗
        </a>
      </div>
    </div>
  );
}
