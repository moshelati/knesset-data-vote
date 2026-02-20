import { cn } from "@/lib/utils";

interface BillStatusBadgeProps {
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  submitted: "הוגשה",
  committee_review: "בוועדה",
  first_reading: "קריאה א'",
  second_reading: "קריאה ב'",
  third_reading: "קריאה ג'",
  passed: "אושרה",
  rejected: "נדחתה",
  withdrawn: "הוסרה",
  expired: "פגת תוקף",
  unknown: "לא ידוע",
};

const STATUS_CLASSES: Record<string, string> = {
  passed: "badge-passed",
  rejected: "badge-rejected",
  committee_review: "badge-committee",
  first_reading: "badge-committee",
  second_reading: "badge-committee",
  third_reading: "badge-committee",
  submitted: "badge-submitted",
};

export function BillStatusBadge({ status }: BillStatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const className = STATUS_CLASSES[status] ?? "badge-unknown";

  return <span className={cn("badge", className)}>{label}</span>;
}
