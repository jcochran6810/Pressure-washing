// Helpers for the recurring_jobs table.

export type RecurrenceKind =
  | "daily"
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "seasonal"
  | "custom_days";

export const RECURRENCE_KINDS: { value: RecurrenceKind; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "triweekly", label: "Every 3 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "semiannual", label: "Every 6 months" },
  { value: "annual", label: "Yearly" },
  { value: "seasonal", label: "Seasonal (every 3 months)" },
  { value: "daily", label: "Daily" },
  { value: "custom_days", label: "Custom (every N days)" },
];

export function advanceDate(from: string, kind: RecurrenceKind, interval = 1): string {
  const d = new Date(from + "T00:00:00");
  const n = Math.max(1, interval);
  switch (kind) {
    case "daily":
      d.setDate(d.getDate() + n);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * n);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "triweekly":
      d.setDate(d.getDate() + 21);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + n);
      break;
    case "quarterly":
    case "seasonal":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semiannual":
      d.setMonth(d.getMonth() + 6);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "custom_days":
      d.setDate(d.getDate() + n);
      break;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
