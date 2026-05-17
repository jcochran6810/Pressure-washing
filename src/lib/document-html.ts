import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import {
  resolveEstimateFields, resolveInvoiceFields,
} from "@/lib/document-fields";

type Org = { name: string; email?: string | null; phone?: string | null; logo_url?: string | null; address_line1?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; document_field_visibility?: any; premium_templates_enabled?: boolean | null };
type Customer = { first_name?: string | null; last_name?: string | null; company_name?: string | null; email?: string | null; phone?: string | null };
type LineItem = { description: string; quantity: number; unit_price: number; total: number };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function header(org: Org, fields: { org_logo: boolean; org_address: boolean; org_phone: boolean; org_email: boolean }) {
  const showAddress = fields.org_address && [org.address_line1, org.city, org.state, org.postal_code].filter(Boolean).length > 0;
  const showPhone = fields.org_phone && !!org.phone;
  const showEmail = fields.org_email && !!org.email;
  const logoTag = fields.org_logo && org.logo_url
    ? `<img src="${escapeHtml(org.logo_url)}" alt="" style="max-height:60px;max-width:160px;object-fit:contain;" />`
    : "";
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:24px;gap:16px;align-items:flex-start;">
      <div>
        <h1 style="margin:0 0 4px;font-size:24px;">${escapeHtml(org.name)}</h1>
        <div style="color:#64748b;font-size:13px;line-height:1.6;">
          ${showAddress ? `${escapeHtml([org.address_line1, org.city, org.state, org.postal_code].filter(Boolean).join(", "))}<br/>` : ""}
          ${showPhone ? escapeHtml(org.phone || "") : ""}${showPhone && showEmail ? " • " : ""}${showEmail ? escapeHtml(org.email || "") : ""}
        </div>
      </div>
      ${logoTag}
    </div>`;
}

function partiesAndMeta(opts: {
  docTitle: string;
  number: string;
  customer: Customer;
  meta: [string, string][];
  showBillTo: boolean;
  showCustomerEmail: boolean;
  showCustomerPhone: boolean;
  preparedBy?: string | null;
}) {
  const preparedTag = opts.preparedBy ? `<div style="color:#64748b;font-size:12px;margin-top:4px;">Prepared by ${escapeHtml(opts.preparedBy)}</div>` : "";
  return `
    <h2 style="font-size:20px;margin:0 0 12px;">${opts.docTitle} <span style="color:#64748b;font-weight:400;">${escapeHtml(opts.number)}</span></h2>
    <div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:18px;">
      ${opts.showBillTo ? `<div>
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Bill to</div>
        <div style="font-weight:600;">${escapeHtml(customerDisplayName(opts.customer))}</div>
        <div style="color:#64748b;font-size:13px;">${opts.showCustomerEmail && opts.customer.email ? escapeHtml(opts.customer.email) : ""}${opts.showCustomerEmail && opts.showCustomerPhone && opts.customer.email && opts.customer.phone ? " • " : ""}${opts.showCustomerPhone && opts.customer.phone ? escapeHtml(opts.customer.phone) : ""}</div>
        ${preparedTag}
      </div>` : (preparedTag || "<div></div>")}
      <table style="font-size:13px;">
        ${opts.meta.map(([k, v]) => `<tr><td style="color:#64748b;padding-right:12px;">${escapeHtml(k)}</td><td style="text-align:right;">${escapeHtml(v)}</td></tr>`).join("")}
      </table>
    </div>`;
}

function lineTable(items: LineItem[], totals: {
  subtotal: number; discount?: number; taxRate?: number; tax?: number; total: number; paid?: number; balance?: number;
  showQty: boolean; showUnitPrice: boolean;
  showSubtotal: boolean; showDiscount: boolean; showTax: boolean;
  showAmountPaid: boolean; showBalanceDue: boolean;
}, currency = "USD") {
  const colCount = 1 + (totals.showQty ? 1 : 0) + (totals.showUnitPrice ? 1 : 0) + 1;
  const totalColSpan = colCount - 1;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Description</th>
          ${totals.showQty ? `<th style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">Qty</th>` : ""}
          ${totals.showUnitPrice ? `<th style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">Price</th>` : ""}
          <th style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((li) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(li.description)}</td>
            ${totals.showQty ? `<td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;">${li.quantity}</td>` : ""}
            ${totals.showUnitPrice ? `<td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;">${formatCurrency(li.unit_price, currency)}</td>` : ""}
            <td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">${formatCurrency(li.total, currency)}</td>
          </tr>`).join("")}
        ${totals.showSubtotal ? `<tr><td colspan="${totalColSpan}" style="text-align:right;padding:6px 8px;color:#64748b;">Subtotal</td><td style="text-align:right;padding:6px 8px;">${formatCurrency(totals.subtotal, currency)}</td></tr>` : ""}
        ${totals.showDiscount && totals.discount && totals.discount > 0 ? `<tr><td colspan="${totalColSpan}" style="text-align:right;padding:6px 8px;color:#64748b;">Discount</td><td style="text-align:right;padding:6px 8px;">− ${formatCurrency(totals.discount, currency)}</td></tr>` : ""}
        ${totals.showTax ? `<tr><td colspan="${totalColSpan}" style="text-align:right;padding:6px 8px;color:#64748b;">Tax (${((totals.taxRate ?? 0) * 100).toFixed(2)}%)</td><td style="text-align:right;padding:6px 8px;">${formatCurrency(totals.tax ?? 0, currency)}</td></tr>` : ""}
        <tr><td colspan="${totalColSpan}" style="text-align:right;padding:8px;border-top:2px solid #e2e8f0;font-weight:700;font-size:14px;">Total</td><td style="text-align:right;padding:8px;border-top:2px solid #e2e8f0;font-weight:700;font-size:14px;">${formatCurrency(totals.total, currency)}</td></tr>
        ${totals.showAmountPaid && typeof totals.paid === "number" ? `<tr><td colspan="${totalColSpan}" style="text-align:right;padding:6px 8px;color:#64748b;">Paid</td><td style="text-align:right;padding:6px 8px;">− ${formatCurrency(totals.paid, currency)}</td></tr>` : ""}
        ${totals.showBalanceDue && typeof totals.balance === "number" ? `<tr><td colspan="${totalColSpan}" style="text-align:right;padding:8px;color:#2563eb;font-weight:700;">Balance due</td><td style="text-align:right;padding:8px;color:#2563eb;font-weight:700;">${formatCurrency(totals.balance, currency)}</td></tr>` : ""}
      </tbody>
    </table>`;
}

function footer(notes?: string | null, terms?: string | null) {
  if (!notes && !terms) return "";
  return `
    <div style="margin-top:24px;display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#475569;">
      ${notes ? `<div><div style="font-weight:600;margin-bottom:4px;">Notes</div>${escapeHtml(notes).replace(/\n/g, "<br/>")}</div>` : ""}
      ${terms ? `<div><div style="font-weight:600;margin-bottom:4px;">Terms</div>${escapeHtml(terms).replace(/\n/g, "<br/>")}</div>` : ""}
    </div>`;
}

function shell(body: string) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;padding:32px;color:#0f172a;max-width:780px;margin:0 auto;">${body}</body></html>`;
}

// Plus / Pro orgs with the templates add-on get their saved field-visibility
// config applied. Starter (or non-premium) orgs always render defaults.
function orgFieldOverrides(org: Org): any {
  return org.premium_templates_enabled ? (org.document_field_visibility ?? {}) : {};
}

export function invoiceHtml(opts: {
  org: Org;
  customer: Customer;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  items: LineItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
  terms?: string | null;
  paid?: boolean;
  currency?: string;
}) {
  const fields = resolveInvoiceFields(orgFieldOverrides(opts.org));
  const meta: [string, string][] = [];
  if (fields.issue_date) meta.push(["Issue date", formatDate(opts.issueDate)]);
  if (fields.due_date) meta.push(["Due date", formatDate(opts.dueDate)]);
  const stamp = opts.paid
    ? `<div style="position:absolute;top:32px;right:32px;border:4px solid #16a34a;color:#16a34a;font-weight:800;letter-spacing:3px;padding:8px 16px;font-size:24px;transform:rotate(-12deg);border-radius:8px;">PAID</div>`
    : "";
  return shell(`
    <div style="position:relative;">
      ${stamp}
      ${header(opts.org, fields)}
      ${partiesAndMeta({
        docTitle: "Invoice",
        number: opts.invoiceNumber,
        customer: opts.customer,
        meta,
        showBillTo: fields.bill_to,
        showCustomerEmail: fields.customer_email,
        showCustomerPhone: fields.customer_phone,
      })}
      ${lineTable(opts.items, {
        subtotal: opts.subtotal, discount: opts.discount, taxRate: opts.taxRate, tax: opts.tax,
        total: opts.total, paid: opts.amountPaid, balance: opts.balanceDue,
        showQty: fields.line_items_quantity, showUnitPrice: fields.line_items_unit_price,
        showSubtotal: fields.subtotal, showDiscount: fields.discount, showTax: fields.tax,
        showAmountPaid: fields.amount_paid, showBalanceDue: fields.balance_due,
      }, opts.currency)}
      ${footer(fields.notes ? opts.notes : null, fields.terms ? opts.terms : null)}
    </div>`);
}

export function estimateHtml(opts: {
  org: Org;
  customer: Customer;
  estimateNumber: string;
  issueDate: string;
  expiresAt: string | null;
  items: LineItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  preparedBy?: string | null;
  depositAmount?: number | null;
  currency?: string;
}) {
  const fields = resolveEstimateFields(orgFieldOverrides(opts.org));
  const meta: [string, string][] = [];
  if (fields.issue_date) meta.push(["Issue date", formatDate(opts.issueDate)]);
  if (fields.expires_at) meta.push(["Expires", formatDate(opts.expiresAt)]);
  const depositLine = fields.deposit && opts.depositAmount
    ? `<div style="margin-top:8px;padding:8px 12px;background:#fef3c7;border-left:4px solid #f59e0b;font-size:13px;border-radius:4px;">Deposit due on approval: <strong>${formatCurrency(opts.depositAmount, opts.currency)}</strong></div>`
    : "";
  return shell(`
    ${header(opts.org, fields)}
    ${partiesAndMeta({
      docTitle: "Estimate",
      number: opts.estimateNumber,
      customer: opts.customer,
      meta,
      showBillTo: fields.bill_to,
      showCustomerEmail: fields.customer_email,
      showCustomerPhone: fields.customer_phone,
      preparedBy: fields.prepared_by ? opts.preparedBy : null,
    })}
    ${lineTable(opts.items, {
      subtotal: opts.subtotal, discount: opts.discount, taxRate: opts.taxRate, tax: opts.tax, total: opts.total,
      showQty: fields.line_items_quantity, showUnitPrice: fields.line_items_unit_price,
      showSubtotal: fields.subtotal, showDiscount: fields.discount, showTax: fields.tax,
      showAmountPaid: false, showBalanceDue: false,
    }, opts.currency)}
    ${depositLine}
    ${footer(fields.notes ? opts.notes : null, fields.terms ? opts.terms : null)}`);
}
