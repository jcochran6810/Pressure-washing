import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";

type Org = {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  logo_url?: string | null;
  // Surfaced on customer-facing docs for tax-exempt / B2B clarity.
  legal_business_name?: string | null;
  tax_id?: string | null;
  tax_id_type?: string | null;
};
type Customer = { first_name?: string | null; last_name?: string | null; company_name?: string | null; email?: string | null; phone?: string | null };
type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  photo_urls?: string[] | null;
  // Optional — when present, the line will show a "(non-taxable)" hint
  // and 'Labor' / 'Material' badge next to the description.
  kind?: "labor" | "material" | "service" | "other" | null;
  taxable?: boolean | null;
};

function header(org: Org) {
  const logo = org.logo_url
    ? `<img src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(org.name)}" style="max-height:64px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : "";
  const addr = [org.address_line1, org.city, org.state, org.postal_code].filter(Boolean).join(", ");
  const contactLine = [org.phone, org.email].filter(Boolean).join(" • ");
  return `
    <div style="margin-bottom:24px;border-bottom:2px solid #e2e8f0;padding-bottom:16px;">
      ${logo}
      <h1 style="margin:0 0 4px;font-size:22px;color:#0f172a;">${escapeHtml(org.name)}</h1>
      <div style="color:#64748b;font-size:12px;line-height:1.6;">
        ${addr ? escapeHtml(addr) + "<br/>" : ""}
        ${contactLine ? escapeHtml(contactLine) : ""}
        ${org.website ? `${contactLine ? " • " : ""}<a href="${escapeHtml(org.website)}" style="color:#64748b;">${escapeHtml(org.website)}</a>` : ""}
      </div>
    </div>`;
}

function partiesAndMeta(opts: { docTitle: string; number: string; customer: Customer; meta: [string, string][] }) {
  return `
    <h2 style="font-size:20px;margin:0 0 12px;">${opts.docTitle} <span style="color:#64748b;font-weight:400;">${opts.number}</span></h2>
    <div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:18px;">
      <div>
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Bill to</div>
        <div style="font-weight:600;">${customerDisplayName(opts.customer)}</div>
        <div style="color:#64748b;font-size:13px;">${opts.customer.email ?? ""}${opts.customer.email && opts.customer.phone ? " • " : ""}${opts.customer.phone ?? ""}</div>
      </div>
      <table style="font-size:13px;">
        ${opts.meta.map(([k, v]) => `<tr><td style="color:#64748b;padding-right:12px;">${k}</td><td style="text-align:right;">${v}</td></tr>`).join("")}
      </table>
    </div>`;
}

function kindBadge(kind?: LineItem["kind"]): string {
  if (kind === "labor")
    return `<span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:4px;margin-right:6px;">Labor</span>`;
  if (kind === "material")
    return `<span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;background:#dcfce7;color:#166534;padding:1px 6px;border-radius:4px;margin-right:6px;">Material</span>`;
  return "";
}

function lineTable(
  items: LineItem[],
  totals: {
    subtotal: number;
    discount?: number;
    taxRate?: number;
    tax?: number;
    total: number;
    paid?: number;
    balance?: number;
    laborSubtotal?: number;
    materialsSubtotal?: number;
    taxableSubtotal?: number;
  },
  currency = "USD",
) {
  const showSplit = (totals.laborSubtotal ?? 0) > 0 && (totals.materialsSubtotal ?? 0) > 0;
  const showTaxableRow =
    (totals.taxableSubtotal ?? 0) !== totals.subtotal && (totals.taxRate ?? 0) > 0;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Description</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">Qty</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">Price</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((li) => {
          const photos = (li.photo_urls ?? []).filter(Boolean);
          const photoRow = photos.length
            ? `<tr><td colspan="4" style="padding:4px 8px 12px;border-bottom:1px solid #f1f5f9;">
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${photos.map((u) => `<img src="${escapeHtml(u)}" alt="" style="width:96px;height:96px;object-fit:cover;border:1px solid #e2e8f0;border-radius:6px;" />`).join("")}
                </div>
              </td></tr>`
            : "";
          const badge = kindBadge(li.kind);
          const nontaxableHint =
            li.taxable === false && (totals.taxRate ?? 0) > 0
              ? `<span style="color:#64748b;font-size:11px;margin-left:6px;">(non-taxable)</span>`
              : "";
          return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${badge}${escapeHtml(li.description)}${nontaxableHint}</td>
            <td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;">${li.quantity}</td>
            <td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;">${formatCurrency(li.unit_price, currency)}</td>
            <td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">${formatCurrency(li.total, currency)}</td>
          </tr>${photoRow}`;
        }).join("")}
        <tr><td colspan="3" style="text-align:right;padding:6px 8px;color:#64748b;">Subtotal</td><td style="text-align:right;padding:6px 8px;">${formatCurrency(totals.subtotal, currency)}</td></tr>
        ${showSplit ? `
        <tr><td colspan="3" style="text-align:right;padding:2px 8px;color:#94a3b8;font-size:11px;">&nbsp;&nbsp;Labor</td><td style="text-align:right;padding:2px 8px;color:#94a3b8;font-size:11px;">${formatCurrency(totals.laborSubtotal ?? 0, currency)}</td></tr>
        <tr><td colspan="3" style="text-align:right;padding:2px 8px;color:#94a3b8;font-size:11px;">&nbsp;&nbsp;Materials</td><td style="text-align:right;padding:2px 8px;color:#94a3b8;font-size:11px;">${formatCurrency(totals.materialsSubtotal ?? 0, currency)}</td></tr>` : ""}
        ${totals.discount && totals.discount > 0 ? `<tr><td colspan="3" style="text-align:right;padding:6px 8px;color:#64748b;">Discount</td><td style="text-align:right;padding:6px 8px;">− ${formatCurrency(totals.discount, currency)}</td></tr>` : ""}
        ${showTaxableRow ? `<tr><td colspan="3" style="text-align:right;padding:2px 8px;color:#94a3b8;font-size:11px;">Taxable amount</td><td style="text-align:right;padding:2px 8px;color:#94a3b8;font-size:11px;">${formatCurrency(totals.taxableSubtotal ?? 0, currency)}</td></tr>` : ""}
        <tr><td colspan="3" style="text-align:right;padding:6px 8px;color:#64748b;">Tax (${((totals.taxRate ?? 0) * 100).toFixed(2)}%)</td><td style="text-align:right;padding:6px 8px;">${formatCurrency(totals.tax ?? 0, currency)}</td></tr>
        <tr><td colspan="3" style="text-align:right;padding:8px;border-top:2px solid #e2e8f0;font-weight:700;font-size:14px;">Total</td><td style="text-align:right;padding:8px;border-top:2px solid #e2e8f0;font-weight:700;font-size:14px;">${formatCurrency(totals.total, currency)}</td></tr>
        ${typeof totals.paid === "number" ? `<tr><td colspan="3" style="text-align:right;padding:6px 8px;color:#64748b;">Paid</td><td style="text-align:right;padding:6px 8px;">− ${formatCurrency(totals.paid, currency)}</td></tr>` : ""}
        ${typeof totals.balance === "number" ? `<tr><td colspan="3" style="text-align:right;padding:8px;color:#2563eb;font-weight:700;">Balance due</td><td style="text-align:right;padding:8px;color:#2563eb;font-weight:700;">${formatCurrency(totals.balance, currency)}</td></tr>` : ""}
      </tbody>
    </table>`;
}

function docPhotoBlock(photos?: { url: string; note: string | null }[]) {
  if (!photos?.length) return "";
  return `
    <div style="margin-top:24px;">
      <h3 style="font-size:14px;margin:0 0 8px;color:#334155;">Pictures</h3>
      <div style="display:flex;flex-wrap:wrap;gap:12px;">
        ${photos.map((p) => `
          <div style="width:240px;border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff;">
            <img src="${escapeHtml(p.url)}" alt="" style="display:block;width:100%;height:160px;object-fit:cover;border-radius:4px;" />
            ${p.note ? `<p style="margin:6px 2px 2px;font-size:11px;color:#475569;line-height:1.4;">${escapeHtml(p.note).replace(/\n/g, "<br/>")}</p>` : ""}
          </div>`).join("")}
      </div>
    </div>`;
}

function footer(notes?: string | null, terms?: string | null, org?: Org) {
  // Surface tax id on customer-facing docs when present — required by some
  // B2B clients for their own bookkeeping. Format EIN as XX-XXXXXXX.
  const taxLine = (() => {
    if (!org?.tax_id) return "";
    const digits = org.tax_id.replace(/[^0-9]/g, "");
    const formatted =
      org.tax_id_type === "EIN" && digits.length === 9
        ? `${digits.slice(0, 2)}-${digits.slice(2)}`
        : digits;
    const label = org.tax_id_type && org.tax_id_type !== "none" ? org.tax_id_type : "Tax ID";
    return `${label}: ${escapeHtml(formatted)}`;
  })();
  const legalName =
    org?.legal_business_name && org.legal_business_name !== org.name
      ? escapeHtml(org.legal_business_name)
      : "";
  const taxBlock = taxLine || legalName
    ? `<div style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:right;">${[legalName, taxLine].filter(Boolean).join(" • ")}</div>`
    : "";
  if (!notes && !terms && !taxBlock) return "";
  return `
    ${notes || terms ? `<div style="margin-top:24px;display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#475569;">
      ${notes ? `<div><div style="font-weight:600;margin-bottom:4px;">Notes</div>${escapeHtml(notes).replace(/\n/g, "<br/>")}</div>` : ""}
      ${terms ? `<div><div style="font-weight:600;margin-bottom:4px;">Terms</div>${escapeHtml(terms).replace(/\n/g, "<br/>")}</div>` : ""}
    </div>` : ""}
    ${taxBlock}`;
}

function shell(body: string) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;padding:32px;color:#0f172a;max-width:780px;margin:0 auto;">${body}</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function invoiceHtml(opts: {
  org: Org;
  customer: Customer;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  items: LineItem[];
  // Document-level reference photos with optional per-photo notes. Renders
  // as a gallery section between the line table and the footer.
  docPhotos?: { url: string; note: string | null }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  laborSubtotal?: number;
  materialsSubtotal?: number;
  taxableSubtotal?: number;
  notes?: string | null;
  terms?: string | null;
  paid?: boolean;
  currency?: string;
}) {
  const stamp = opts.paid
    ? `<div style="position:absolute;top:32px;right:32px;border:4px solid #16a34a;color:#16a34a;font-weight:800;letter-spacing:3px;padding:8px 16px;font-size:24px;transform:rotate(-12deg);border-radius:8px;">PAID</div>`
    : "";
  return shell(`
    <div style="position:relative;">
      ${stamp}
      ${header(opts.org)}
      ${partiesAndMeta({
        docTitle: "Invoice",
        number: opts.invoiceNumber,
        customer: opts.customer,
        meta: [["Issue date", formatDate(opts.issueDate)], ["Due date", formatDate(opts.dueDate)]],
      })}
      ${lineTable(opts.items, {
        subtotal: opts.subtotal,
        discount: opts.discount,
        taxRate: opts.taxRate,
        tax: opts.tax,
        total: opts.total,
        paid: opts.amountPaid,
        balance: opts.balanceDue,
        laborSubtotal: opts.laborSubtotal,
        materialsSubtotal: opts.materialsSubtotal,
        taxableSubtotal: opts.taxableSubtotal,
      }, opts.currency)}
      ${docPhotoBlock(opts.docPhotos)}
      ${footer(opts.notes, opts.terms, opts.org)}
    </div>`);
}

export function estimateHtml(opts: {
  org: Org;
  customer: Customer;
  estimateNumber: string;
  issueDate: string;
  expiresAt: string | null;
  items: LineItem[];
  docPhotos?: { url: string; note: string | null }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  laborSubtotal?: number;
  materialsSubtotal?: number;
  taxableSubtotal?: number;
  notes?: string | null;
  terms?: string | null;
  currency?: string;
}) {
  return shell(`
    ${header(opts.org)}
    ${partiesAndMeta({
      docTitle: "Estimate",
      number: opts.estimateNumber,
      customer: opts.customer,
      meta: [["Issue date", formatDate(opts.issueDate)], ["Expires", formatDate(opts.expiresAt)]],
    })}
    ${lineTable(opts.items, {
      subtotal: opts.subtotal,
      discount: opts.discount,
      taxRate: opts.taxRate,
      tax: opts.tax,
      total: opts.total,
      laborSubtotal: opts.laborSubtotal,
      materialsSubtotal: opts.materialsSubtotal,
      taxableSubtotal: opts.taxableSubtotal,
    }, opts.currency)}
    ${docPhotoBlock(opts.docPhotos)}
    ${footer(opts.notes, opts.terms, opts.org)}`);
}
