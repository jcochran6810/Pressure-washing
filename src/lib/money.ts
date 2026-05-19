// Pure financial helpers. No DB, no IO. Test these aggressively.

export type InvoiceTotals = {
  subtotal: number;
  discount?: number;
  tax_rate?: number;
};

export type PaymentResult = {
  new_amount_paid: number;
  new_balance_due: number;
  new_status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
};

// Compute a new invoice state after a payment is recorded.
// - Capped at 0 (never negative balance).
// - "paid" requires balance == 0.
// - Otherwise "partial" if any payment has been applied.
// - First payment on a "draft" promotes to "sent" implicitly via app code,
//   but here we just report based on current values.
export function applyPayment(opts: {
  current_total: number;
  current_amount_paid: number;
  payment_amount: number;
  current_status: string;
}): PaymentResult {
  const total = Number(opts.current_total) || 0;
  const paid = Number(opts.current_amount_paid) || 0;
  const amount = Number(opts.payment_amount) || 0;

  const new_amount_paid = Math.max(0, Number((paid + amount).toFixed(2)));
  const new_balance_due = Math.max(0, Number((total - new_amount_paid).toFixed(2)));

  let new_status: PaymentResult["new_status"];
  if (new_balance_due === 0 && total > 0) new_status = "paid";
  else if (new_amount_paid > 0) new_status = "partial";
  else new_status = (opts.current_status as PaymentResult["new_status"]) || "draft";

  return { new_amount_paid, new_balance_due, new_status };
}

export type LineItem = { quantity: number; unit_price: number };

// Compute subtotal/tax/total from line items, with discount and tax rate.
// All amounts rounded to 2 decimal places to avoid float drift.
export function computeDocumentTotals(items: LineItem[], opts: {
  discount?: number;
  tax_rate?: number;
}) {
  const subtotal = round2(items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0));
  const discount = round2(Math.max(0, Number(opts.discount ?? 0)));
  const taxable = Math.max(0, subtotal - discount);
  const tax_rate = Number(opts.tax_rate ?? 0);
  const tax_amount = round2(taxable * tax_rate);
  const total = round2(taxable + tax_amount);
  return { subtotal, discount, tax_amount, total };
}

// Compute the auto-deposit amount based on org settings.
// Returns null when the threshold isn't met or deposits are disabled.
export function computeDeposit(total: number, opts: {
  deposit_threshold?: number;
  deposit_percentage?: number;
}): number | null {
  const threshold = Number(opts.deposit_threshold ?? 0);
  const pct = Number(opts.deposit_percentage ?? 0.25);
  if (threshold <= 0 || total < threshold) return null;
  return round2(total * pct);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Subscription state classification — pure mirror of /lib/billing.ts logic,
// duplicated for unit tests so we don't depend on importing the full module.
export type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | null;

export function classifyAccessLevel(opts: {
  status: SubStatus;
  trial_ends_at?: string | null;
  now?: number;
}): "active" | "trialing_active" | "trial_expired" | "restricted" {
  const now = opts.now ?? Date.now();
  if (opts.status === "active") return "active";
  if (opts.status === "trialing") {
    const end = opts.trial_ends_at ? new Date(opts.trial_ends_at).getTime() : 0;
    if (end > now) return "trialing_active";
    return "trial_expired";
  }
  return "restricted";
}
