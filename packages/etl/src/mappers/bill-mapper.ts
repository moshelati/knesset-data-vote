/**
 * Knesset OData → Prisma Bill mapper
 *
 * Entity sets confirmed from live KNS OData metadata:
 * KNS_Bill, KNS_BillInitiator, KNS_BillHistoryInitiator
 * Status IDs sourced from KNS_Status (TypeID=2 = הצעת חוק)
 */

import type { Prisma } from "@knesset-vote/db";
import { KNESSET_ODATA_BASE, TOPIC_KEYWORDS } from "@knesset-vote/shared";

export const BILL_ENTITY_SET_CANDIDATES = [
  "KNS_Bill",
  "KnssBill",
  "Bill",
  "PrivateBill",
  "GovernmentBill",
  "LawBill",
];

export const BILL_INITIATOR_ENTITY_SET_CANDIDATES = [
  "KNS_BillInitiator",
  "KnssBillInitiator",
  "BillInitiator",
  "BillMember",
  "BillSponsor",
];

// Note: KNS_BillHistoryInitiator is about initiator roster changes (not legislative stages)
// KNS_BillHistory does not exist in the OData. Bill reading history is not exposed via OData.
export const BILL_STAGE_ENTITY_SET_CANDIDATES = [
  "KNS_BillHistory",
  "KnssBillHistoryByStage",
  "BillStage",
  "BillHistory",
  "LawHistory",
];

export interface RawBill {
  BillID?: number;
  ID?: number;
  Id?: number;
  KnessetNum?: number;
  Name?: string;
  Title?: string;
  BillName?: string;
  SummaryLaw?: string | null;
  SubmitDate?: string | null;
  PublicationDate?: string | null;
  LastUpdatedDate?: string | null;
  StatusID?: number;
  StatusDesc?: string | null;
  SubTypeID?: number;
  SubTypeDesc?: string | null;
  IsGovernmentBill?: boolean;
  [key: string]: unknown;
}

export interface RawBillInitiator {
  BillInitiatorID?: number;
  BillID?: number;
  PersonID?: number;
  MemberID?: number;
  IsInitiator?: boolean;
  [key: string]: unknown;
}

export interface RawBillStage {
  BillHistoryInitiatorID?: number;
  BillHistoryID?: number;
  BillID?: number;
  StageID?: number;
  StageName?: string;
  StageDesc?: string | null;
  StageDate?: string | null;
  StartDate?: string | null;
  EndDate?: string | null;
  CommitteeID?: number | null;
  CommitteeName?: string | null;
  ReasonDesc?: string | null;
  [key: string]: unknown;
}

// Real StatusIDs from KNS_Status (TypeID=2, הצעת חוק)
const STATUS_MAP: Record<number, string> = {
  101: "first_reading", // הכנה לקריאה ראשונה
  104: "submitted", // הונחה על שולחן הכנסת לדיון מוקדם
  106: "committee_review", // בוועדת הכנסת לקביעת הוועדה המטפלת
  108: "first_reading", // הכנה לקריאה ראשונה
  109: "first_reading", // אושרה בוועדה לקריאה ראשונה
  110: "rejected", // הבקשה לדין רציפות נדחתה במליאה
  111: "first_reading", // לדיון במליאה לקראת הקריאה הראשונה
  113: "second_reading", // הכנה לקריאה שנייה ושלישית
  114: "second_reading", // לדיון במליאה לקראת קריאה שנייה-שלישית
  115: "third_reading", // הוחזרה לוועדה להכנה לקריאה שלישית
  117: "third_reading", // לדיון במליאה לקראת קריאה שלישית
  118: "passed", // התקבלה בקריאה שלישית
  120: "committee_review", // לדיון במליאה על החלת דין רציפות
  122: "withdrawn", // מוזגה עם הצעת חוק אחרת
  124: "withdrawn", // הוסבה להצעה לסדר היום
  130: "second_reading", // הונחה על שולחן הכנסת לקריאה שנייה-שלישית
  131: "third_reading", // הונחה על שולחן הכנסת לקריאה שלישית
  140: "withdrawn", // להסרה מסדר היום לבקשת ועדה
  141: "first_reading", // הונחה על שולחן הכנסת לקריאה ראשונה
  142: "committee_review", // בוועדת הכנסת לקביעת הוועדה המטפלת
  143: "withdrawn", // להסרה מסדר היום לבקשת ועדה
  150: "submitted", // במליאה לדיון מוקדם
  158: "committee_review", // לאישור פיצול במליאה
  161: "committee_review", // לאישור פיצול במליאה
  162: "committee_review", // לאישור פיצול במליאה
  165: "committee_review", // לאישור פיצול במליאה
  167: "first_reading", // אושרה בוועדה לקריאה ראשונה
  175: "committee_review", // בדיון בוועדה על החלת דין רציפות
  176: "rejected", // הבקשה לדין רציפות נדחתה בוועדה
  177: "withdrawn", // נעצרה
  178: "second_reading", // אושרה בוועדה לקריאה שנייה-שלישית
  179: "second_reading", // אושרה בוועדה לקריאה שנייה-שלישית
  181: "committee_review", // הודעה על בקשה להחלת דין רציפות
};

function mapStatus(statusId?: number, statusDesc?: string | null): string {
  if (statusId && STATUS_MAP[statusId]) return STATUS_MAP[statusId];
  // Hebrew keyword fallback for statuses not in the map
  if (statusDesc) {
    const desc = statusDesc;
    if (desc.includes("התקבלה")) return "passed";
    if (desc.includes("נדחה") || desc.includes("לא עבר")) return "rejected";
    if (desc.includes("נעצרה") || desc.includes("מוזגה") || desc.includes("הוסבה"))
      return "withdrawn";
    if (desc.includes("קריאה שלישית")) return "third_reading";
    if (desc.includes("קריאה שנייה")) return "second_reading";
    if (desc.includes("קריאה ראשונה")) return "first_reading";
    if (desc.includes("ועדה")) return "committee_review";
    if (desc.includes("הונחה") || desc.includes("הוגשה")) return "submitted";
  }
  return "unknown";
}

/**
 * Static topic tagger based on TOPIC_KEYWORDS map.
 * MVP: keyword matching; Later: NLP classification.
 */
export function inferTopic(title?: string | null, description?: string | null): string | null {
  const text = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (!text.trim()) return null;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return topic;
    }
  }
  return "other";
}

export function mapBillToBill(raw: RawBill): Prisma.BillCreateInput {
  const id = raw.BillID ?? raw.ID ?? raw.Id;

  if (!id) {
    throw new Error(`Bill record missing ID: ${JSON.stringify(raw)}`);
  }

  const title = raw.Name ?? raw.Title ?? raw.BillName ?? "Unknown";

  return {
    external_id: String(id),
    external_source: "knesset_odata",
    title_he: String(title),
    title_en: null,
    description_he: raw.SummaryLaw ? String(raw.SummaryLaw) : null,
    description_en: null,
    status: mapStatus(raw.StatusID, raw.StatusDesc ?? raw.SubTypeDesc),
    topic: inferTopic(String(title), raw.SummaryLaw),
    knesset_number: raw.KnessetNum ? Number(raw.KnessetNum) : null,
    submitted_date: raw.SubmitDate
      ? new Date(raw.SubmitDate)
      : raw.PublicationDate
        ? new Date(raw.PublicationDate)
        : null,
    last_status_date: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
    is_demo: false,
    source_url: `${KNESSET_ODATA_BASE}/KNS_Bill(${id})`,
    last_seen_at: new Date(),
    last_changed_at: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
  };
}
