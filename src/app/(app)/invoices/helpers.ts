// Pure helpers shared by the invoice routes. Lives outside actions.ts
// because that file is "use server" and may only export async functions.

// An invoice is editable while it's a draft. Anything past draft — sent,
// partial, paid, overdue, void — is locked because it's been seen by the
// customer (or paid against). Refund / payment-reversal handled separately.
export function isInvoiceEditable(status: string | null | undefined): boolean {
  return (status ?? "draft") === "draft";
}
