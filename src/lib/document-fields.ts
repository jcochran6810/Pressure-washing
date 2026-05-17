// Field visibility configuration for customer-facing documents.
// Plus / Pro plans with the premium templates add-on can override these.
// Starter customers always see the defaults.

export type DocumentKind = "estimate" | "invoice" | "receipt";

// Every togglable field across the three document types. When you add a new
// field to estimateHtml / invoiceHtml / receiptHtml, add it here.
export type EstimateFields = {
  prepared_by: boolean;
  org_address: boolean;
  org_phone: boolean;
  org_email: boolean;
  org_logo: boolean;
  bill_to: boolean;
  customer_email: boolean;
  customer_phone: boolean;
  issue_date: boolean;
  expires_at: boolean;
  line_items_quantity: boolean;
  line_items_unit_price: boolean;
  subtotal: boolean;
  discount: boolean;
  tax: boolean;
  deposit: boolean;
  notes: boolean;
  terms: boolean;
};

export type InvoiceFields = {
  org_address: boolean;
  org_phone: boolean;
  org_email: boolean;
  org_logo: boolean;
  bill_to: boolean;
  customer_email: boolean;
  customer_phone: boolean;
  issue_date: boolean;
  due_date: boolean;
  line_items_quantity: boolean;
  line_items_unit_price: boolean;
  subtotal: boolean;
  discount: boolean;
  tax: boolean;
  amount_paid: boolean;
  balance_due: boolean;
  notes: boolean;
  terms: boolean;
};

export type ReceiptFields = {
  org_address: boolean;
  org_phone: boolean;
  org_email: boolean;
  org_logo: boolean;
  invoice_number: boolean;
  payment_method: boolean;
  payment_date: boolean;
  invoice_total: boolean;
  remaining_balance: boolean;
};

const ESTIMATE_DEFAULTS: EstimateFields = {
  prepared_by: true,
  org_address: true,
  org_phone: true,
  org_email: true,
  org_logo: true,
  bill_to: true,
  customer_email: true,
  customer_phone: true,
  issue_date: true,
  expires_at: true,
  line_items_quantity: true,
  line_items_unit_price: true,
  subtotal: true,
  discount: true,
  tax: true,
  deposit: true,
  notes: true,
  terms: true,
};

const INVOICE_DEFAULTS: InvoiceFields = {
  org_address: true,
  org_phone: true,
  org_email: true,
  org_logo: true,
  bill_to: true,
  customer_email: true,
  customer_phone: true,
  issue_date: true,
  due_date: true,
  line_items_quantity: true,
  line_items_unit_price: true,
  subtotal: true,
  discount: true,
  tax: true,
  amount_paid: true,
  balance_due: true,
  notes: true,
  terms: true,
};

const RECEIPT_DEFAULTS: ReceiptFields = {
  org_address: true,
  org_phone: true,
  org_email: true,
  org_logo: true,
  invoice_number: true,
  payment_method: true,
  payment_date: true,
  invoice_total: true,
  remaining_balance: true,
};

// Read the org's stored overrides and merge with defaults.
export function resolveEstimateFields(orgConfig: any): EstimateFields {
  const overrides = orgConfig?.estimate ?? {};
  return { ...ESTIMATE_DEFAULTS, ...overrides };
}
export function resolveInvoiceFields(orgConfig: any): InvoiceFields {
  const overrides = orgConfig?.invoice ?? {};
  return { ...INVOICE_DEFAULTS, ...overrides };
}
export function resolveReceiptFields(orgConfig: any): ReceiptFields {
  const overrides = orgConfig?.receipt ?? {};
  return { ...RECEIPT_DEFAULTS, ...overrides };
}

// Friendly labels for the admin UI.
export const ESTIMATE_FIELD_LABELS: Record<keyof EstimateFields, string> = {
  prepared_by: "&quot;Prepared by&quot; name",
  org_address: "Your business address",
  org_phone: "Your business phone",
  org_email: "Your business email",
  org_logo: "Your logo",
  bill_to: "Bill-to (customer name)",
  customer_email: "Customer email",
  customer_phone: "Customer phone",
  issue_date: "Issue date",
  expires_at: "Expiration date",
  line_items_quantity: "Quantity column",
  line_items_unit_price: "Unit price column",
  subtotal: "Subtotal",
  discount: "Discount line",
  tax: "Tax line",
  deposit: "Required deposit notice",
  notes: "Notes section",
  terms: "Terms section",
};
export const INVOICE_FIELD_LABELS: Record<keyof InvoiceFields, string> = {
  org_address: "Your business address",
  org_phone: "Your business phone",
  org_email: "Your business email",
  org_logo: "Your logo",
  bill_to: "Bill-to (customer name)",
  customer_email: "Customer email",
  customer_phone: "Customer phone",
  issue_date: "Issue date",
  due_date: "Due date",
  line_items_quantity: "Quantity column",
  line_items_unit_price: "Unit price column",
  subtotal: "Subtotal",
  discount: "Discount line",
  tax: "Tax line",
  amount_paid: "Amount paid",
  balance_due: "Balance due",
  notes: "Notes section",
  terms: "Terms section",
};
export const RECEIPT_FIELD_LABELS: Record<keyof ReceiptFields, string> = {
  org_address: "Your business address",
  org_phone: "Your business phone",
  org_email: "Your business email",
  org_logo: "Your logo",
  invoice_number: "Invoice number reference",
  payment_method: "Payment method",
  payment_date: "Payment date",
  invoice_total: "Invoice total",
  remaining_balance: "Remaining balance",
};
