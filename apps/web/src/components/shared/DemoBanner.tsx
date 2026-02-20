import { AlertTriangle } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="demo-banner" role="alert" aria-live="polite">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <strong>נתוני הדגמה בלבד</strong> — מידע זה אינו ממקור רשמי ומיועד להדגמת הממשק בלבד.
          הנתונים הרשמיים ייטענו מה-Knesset OData API בהפעלת ETL.
        </div>
      </div>
    </div>
  );
}
