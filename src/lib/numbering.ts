// Document numbering helpers.
//
// Format going forward: YY-NNNN — two-digit year + zero-padded counter.
// Example for 2026, counter 1058: "26-1058".
//
// The same numeric body flows through the chain — an estimate's number is
// reused by the job, the invoice, and the receipt rather than allocating
// new numbers each step. The displayed prefix word (Est / Job / Invoice /
// Receipt) is chosen at render time from the workflow state.
//
// Legacy data (e.g. "EST-1001", "INV-1058") renders cleanly through
// displayDocumentLabel — known prefix words are stripped before the new
// label is applied.

const LEGACY_PREFIX = /^(est|inv|job|rec)[-\s]?/i;

export type DocumentKind = "estimate" | "job" | "invoice" | "receipt";

export function documentLabelFor(kind: DocumentKind): string {
  switch (kind) {
    case "estimate": return "Est";
    case "job": return "Job";
    case "invoice": return "Invoice";
    case "receipt": return "Receipt";
  }
}

// Renders e.g. "Job 26-1058" from a stored number string + kind. Strips a
// legacy prefix if the stored string still has one ("EST-1001" → "Est 1001").
export function displayDocumentLabel(kind: DocumentKind, number: string | null | undefined): string {
  if (!number) return documentLabelFor(kind);
  const trimmed = number.trim().replace(LEGACY_PREFIX, "");
  return `${documentLabelFor(kind)} ${trimmed}`;
}

// Format a numeric counter as YY-NNNN. Pads to at least 4 digits so the
// numbers sort lexically.
export function formatDocumentNumber(counter: number, year: number = new Date().getFullYear()): string {
  const yy = String(year % 100).padStart(2, "0");
  const n = String(counter).padStart(4, "0");
  return `${yy}-${n}`;
}

// Allocate the next document number for an org. Uses next_estimate_number
// as the shared counter (estimates and invoices that derive from estimates
// reuse the same number; standalone invoices pull from this counter too).
// Bumps the counter atomically-ish (read-then-write).
export async function nextDocumentNumber(supabase: any, organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from("organizations")
    .select("next_estimate_number")
    .eq("id", organizationId)
    .single();
  const current = Number(org?.next_estimate_number ?? 1000);
  await supabase
    .from("organizations")
    .update({ next_estimate_number: current + 1 })
    .eq("id", organizationId);
  return formatDocumentNumber(current);
}

// Workflow-aware label: picks Est / Job / Invoice / Receipt based on the
// furthest stage we've reached so the estimate detail page header reads
// "Job 26-1058" once a job exists, "Invoice 26-1058" once invoiced, etc.
export function workflowLabel(
  number: string | null | undefined,
  flags: { hasJob?: boolean; hasInvoice?: boolean; invoicePaid?: boolean; receiptSent?: boolean },
): string {
  const kind: DocumentKind =
    flags.receiptSent || flags.invoicePaid ? "receipt" :
    flags.hasInvoice ? "invoice" :
    flags.hasJob ? "job" :
    "estimate";
  return displayDocumentLabel(kind, number);
}
