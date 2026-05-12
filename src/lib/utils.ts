import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function customerDisplayName(c: {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}) {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

export function statusColor(status: string | null | undefined) {
  switch (status) {
    case "draft": return "bg-gray-100 text-gray-700";
    case "sent": return "bg-blue-100 text-blue-700";
    case "accepted":
    case "paid":
    case "completed":
    case "won":
      return "bg-green-100 text-green-700";
    case "partial":
    case "in_progress":
    case "contacted":
      return "bg-yellow-100 text-yellow-700";
    case "overdue":
    case "declined":
    case "lost":
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "scheduled":
    case "new":
    case "quoted":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
