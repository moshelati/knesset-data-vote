import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not available from source";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export const BILL_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  submitted: "הוגשה",
  committee_review: "בדיון בוועדה",
  first_reading: "קריאה ראשונה",
  second_reading: "קריאה שנייה",
  third_reading: "קריאה שלישית",
  passed: "אושרה",
  rejected: "נדחתה",
  withdrawn: "הוסרה",
  expired: "פגת תוקף",
  unknown: "לא ידוע",
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Limited data",
  unavailable: "Not available from source",
};

export const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-confidence-high",
  medium: "text-confidence-medium",
  low: "text-confidence-low",
  unavailable: "text-confidence-unavailable",
};
