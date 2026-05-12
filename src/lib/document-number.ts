// Document numbering shared across estimates -> jobs -> invoices.
//
// One logical "document number" is assigned when the estimate is created
// and inherited by the resulting job and invoice. The number is stored
// in its bare form ("YY-NNNN", e.g. "26-1032") and the prefix is computed
// at display time based on the entity type and status:
//
//   estimate              -> EST-26-1032
//   job                   -> JOB-26-1032
//   invoice (unpaid)      -> INVOICE-26-1032
//   invoice (paid)        -> RECEIPT-26-1032
//
// The shared counter lives on organizations.next_estimate_number so the
// numbers continue 1032, 1033, 1034 ... across years. Only the YY prefix
// rolls over on Jan 1.

export type DocumentKind = "estimate" | "job" | "invoice";

/** Two-digit current year, e.g. "26". */
export function yearPrefix(d: Date = new Date()): string {
  return String(d.getFullYear() % 100).padStart(2, "0");
}

/**
 * Reserve and return the next shared document number for the org as "YY-NNNN".
 * Uses organizations.next_estimate_number as the single shared counter.
 */
export async function nextDocumentNumber(supabase: any, organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from("organizations")
    .select("next_estimate_number")
    .eq("id", organizationId)
    .single();
  const num = org?.next_estimate_number ?? 1000;
  await supabase
    .from("organizations")
    .update({ next_estimate_number: num + 1 })
    .eq("id", organizationId);
  return `${yearPrefix()}-${num}`;
}

/**
 * Strip any legacy prefix from a stored number, leaving the bare portion.
 * Handles old data (EST-1015) and new data (26-1032) gracefully.
 */
export function bareNumber(stored: string | null | undefined): string {
  if (!stored) return "";
  return stored.replace(/^(EST|INV|JOB|INVOICE|RECEIPT)-/i, "");
}

/**
 * Render the display label for a document.
 * Works for both legacy (no year segment) and new (with year segment) numbers.
 */
export function documentLabel(
  kind: DocumentKind,
  status: string | null | undefined,
  stored: string | null | undefined,
): string {
  const bare = bareNumber(stored);
  if (!bare) return "—";
  let prefix: string;
  if (kind === "estimate") prefix = "EST";
  else if (kind === "job") prefix = "JOB";
  else prefix = status === "paid" ? "RECEIPT" : "INVOICE";
  return `${prefix}-${bare}`;
}
