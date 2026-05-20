import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
};
type Customer = {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
};
type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  materials_description?: string | null;
  materials_cost?: number | null;
};

type DocInput = {
  org: Org;
  customer: Customer;
  docTitle: string;
  number: string;
  meta: [string, string][];
  items: LineItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  notes?: string | null;
  terms?: string | null;
  currency?: string;
  paidStamp?: boolean;
};

// Strip the few characters pdf-lib's WinAnsi encoding can't handle (mainly
// the unicode minus sign and curly quotes some templates use).
function sanitize(s: string): string {
  return s
    .replace(/−/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "*");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = sanitize(text).split(/\r?\n/);
  for (const para of paragraphs) {
    if (!para) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

type Cursor = { page: PDFPage; y: number };

function ensureSpace(doc: PDFDocument, cursor: Cursor, need: number, margin = 40): Cursor {
  if (cursor.y - need < margin) {
    const { width, height } = cursor.page.getSize();
    const page = doc.addPage([width, height]);
    return { page, y: height - margin };
  }
  return cursor;
}

export async function buildDocumentPdf(input: DocInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter @ 72dpi
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursor: Cursor = { page, y: pageHeight - margin };
  const text = "#0f172a";
  const muted = "#64748b";
  const line = "#e2e8f0";

  const toRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  };

  function drawText(s: string, x: number, y: number, opts: { size?: number; font?: PDFFont; color?: string } = {}) {
    const f = opts.font ?? font;
    cursor.page.drawText(sanitize(s), {
      x,
      y,
      size: opts.size ?? 10,
      font: f,
      color: toRgb(opts.color ?? text),
    });
  }

  function drawWrapped(s: string, x: number, opts: { size?: number; font?: PDFFont; color?: string; width?: number; lineGap?: number }) {
    const f = opts.font ?? font;
    const size = opts.size ?? 10;
    const gap = opts.lineGap ?? 4;
    const width = opts.width ?? contentWidth - x + margin;
    const lines = wrap(s, f, size, width);
    for (const ln of lines) {
      cursor = ensureSpace(pdf, cursor, size + gap, margin);
      cursor.page.drawText(ln, { x, y: cursor.y - size, size, font: f, color: toRgb(opts.color ?? text) });
      cursor.y -= size + gap;
    }
  }

  function hr() {
    cursor = ensureSpace(pdf, cursor, 12, margin);
    cursor.page.drawLine({
      start: { x: margin, y: cursor.y - 4 },
      end: { x: pageWidth - margin, y: cursor.y - 4 },
      thickness: 1,
      color: toRgb(line),
    });
    cursor.y -= 12;
  }

  // ---- Header
  drawText(input.org.name, margin, cursor.y - 16, { size: 16, font: bold });
  cursor.y -= 22;

  const orgAddr = [input.org.address_line1, input.org.city, input.org.state, input.org.postal_code]
    .filter(Boolean)
    .join(", ");
  const orgContact = [input.org.phone, input.org.email, input.org.website].filter(Boolean).join("  •  ");
  if (orgAddr) {
    drawText(orgAddr, margin, cursor.y - 10, { size: 9, color: muted });
    cursor.y -= 12;
  }
  if (orgContact) {
    drawText(orgContact, margin, cursor.y - 10, { size: 9, color: muted });
    cursor.y -= 12;
  }
  cursor.y -= 4;
  hr();

  // ---- Title + number
  drawText(input.docTitle, margin, cursor.y - 18, { size: 18, font: bold });
  drawText(input.number, margin + bold.widthOfTextAtSize(input.docTitle, 18) + 8, cursor.y - 18, {
    size: 14,
    color: muted,
  });
  cursor.y -= 26;

  // Optional PAID stamp top-right
  if (input.paidStamp) {
    const stamp = "PAID";
    const stampSize = 28;
    const w = bold.widthOfTextAtSize(stamp, stampSize) + 24;
    const stampX = pageWidth - margin - w;
    cursor.page.drawRectangle({
      x: stampX,
      y: pageHeight - margin - 36,
      width: w,
      height: 36,
      borderColor: rgb(0.086, 0.639, 0.29),
      borderWidth: 2,
      color: rgb(1, 1, 1),
    });
    cursor.page.drawText(stamp, {
      x: stampX + 12,
      y: pageHeight - margin - 28,
      size: stampSize,
      font: bold,
      color: rgb(0.086, 0.639, 0.29),
    });
  }

  // ---- Bill to + meta in two columns
  const leftX = margin;
  const rightX = pageWidth / 2 + 20;
  let leftY = cursor.y;
  let rightY = cursor.y;

  drawText("BILL TO", leftX, leftY - 10, { size: 8, color: muted, font: bold });
  leftY -= 14;
  drawText(customerDisplayName(input.customer), leftX, leftY - 11, { size: 11, font: bold });
  leftY -= 14;
  const custContact = [input.customer.email, input.customer.phone].filter(Boolean).join("  •  ");
  if (custContact) {
    drawText(custContact, leftX, leftY - 10, { size: 9, color: muted });
    leftY -= 12;
  }

  for (const [k, v] of input.meta) {
    drawText(k, rightX, rightY - 10, { size: 9, color: muted });
    const vw = font.widthOfTextAtSize(sanitize(v), 9);
    drawText(v, pageWidth - margin - vw, rightY - 10, { size: 9 });
    rightY -= 14;
  }

  cursor.y = Math.min(leftY, rightY) - 12;
  hr();

  // ---- Line items table
  const colDescX = margin;
  const colQtyX = pageWidth - margin - 280;
  const colPriceX = pageWidth - margin - 180;
  const colTotalX = pageWidth - margin - 70;
  const currency = input.currency ?? "USD";

  cursor = ensureSpace(pdf, cursor, 24);
  drawText("Description", colDescX, cursor.y - 11, { size: 9, color: muted, font: bold });
  drawText("Qty", colQtyX + 50, cursor.y - 11, { size: 9, color: muted, font: bold });
  drawText("Price", colPriceX + 60, cursor.y - 11, { size: 9, color: muted, font: bold });
  drawText("Total", colTotalX + 50, cursor.y - 11, { size: 9, color: muted, font: bold });
  cursor.y -= 18;
  cursor.page.drawLine({
    start: { x: margin, y: cursor.y },
    end: { x: pageWidth - margin, y: cursor.y },
    thickness: 0.5,
    color: toRgb(line),
  });
  cursor.y -= 4;

  for (const li of input.items) {
    const descLines = wrap(li.description || "", font, 10, colQtyX - colDescX - 10);
    const matCost = Number(li.materials_cost ?? 0);
    const matLines = matCost > 0
      ? wrap(
          `+ Materials${li.materials_description ? `: ${li.materials_description}` : ""} (${formatCurrency(matCost, currency)})`,
          font,
          9,
          colQtyX - colDescX - 24,
        )
      : [];
    const rowHeight = Math.max(14, descLines.length * 12 + matLines.length * 11 + 4);
    cursor = ensureSpace(pdf, cursor, rowHeight + 4);
    let y = cursor.y;
    for (let i = 0; i < descLines.length; i++) {
      cursor.page.drawText(descLines[i], { x: colDescX, y: y - 11, size: 10, font, color: toRgb(text) });
      y -= 12;
    }
    for (const ml of matLines) {
      cursor.page.drawText(sanitize(ml), { x: colDescX + 12, y: y - 10, size: 9, font, color: toRgb("#a16207") });
      y -= 11;
    }
    const qty = String(li.quantity);
    const price = formatCurrency(li.unit_price, currency);
    const total = formatCurrency(li.total, currency);
    const baseY = cursor.y - 11;
    cursor.page.drawText(qty, {
      x: colPriceX - font.widthOfTextAtSize(qty, 10) - 10,
      y: baseY,
      size: 10,
      font,
      color: toRgb(text),
    });
    cursor.page.drawText(sanitize(price), {
      x: colTotalX - font.widthOfTextAtSize(sanitize(price), 10) - 10,
      y: baseY,
      size: 10,
      font,
      color: toRgb(text),
    });
    cursor.page.drawText(sanitize(total), {
      x: pageWidth - margin - bold.widthOfTextAtSize(sanitize(total), 10),
      y: baseY,
      size: 10,
      font: bold,
      color: toRgb(text),
    });
    cursor.y -= rowHeight;
    cursor.page.drawLine({
      start: { x: margin, y: cursor.y },
      end: { x: pageWidth - margin, y: cursor.y },
      thickness: 0.25,
      color: toRgb("#f1f5f9"),
    });
    cursor.y -= 2;
  }

  // ---- Totals
  cursor.y -= 8;
  const totalsRow = (label: string, value: string, isBold = false, color = text) => {
    cursor = ensureSpace(pdf, cursor, 16);
    const f = isBold ? bold : font;
    drawText(label, pageWidth - margin - 200, cursor.y - 11, { size: 10, color: muted });
    const vw = f.widthOfTextAtSize(sanitize(value), 10);
    cursor.page.drawText(sanitize(value), {
      x: pageWidth - margin - vw,
      y: cursor.y - 11,
      size: 10,
      font: f,
      color: toRgb(color),
    });
    cursor.y -= 14;
  };
  totalsRow("Subtotal", formatCurrency(input.subtotal, currency));
  if (input.discount > 0) totalsRow("Discount", `- ${formatCurrency(input.discount, currency)}`);
  totalsRow(`Tax (${(input.taxRate * 100).toFixed(2)}%)`, formatCurrency(input.tax, currency));
  cursor = ensureSpace(pdf, cursor, 18);
  cursor.page.drawLine({
    start: { x: pageWidth - margin - 200, y: cursor.y - 2 },
    end: { x: pageWidth - margin, y: cursor.y - 2 },
    thickness: 1,
    color: toRgb(line),
  });
  cursor.y -= 6;
  totalsRow("Total", formatCurrency(input.total, currency), true);
  if (typeof input.amountPaid === "number") {
    totalsRow("Paid", `- ${formatCurrency(input.amountPaid, currency)}`);
  }
  if (typeof input.balanceDue === "number") {
    totalsRow("Balance due", formatCurrency(input.balanceDue, currency), true, "#2563eb");
  }

  // ---- Notes / Terms
  if (input.notes) {
    cursor.y -= 12;
    cursor = ensureSpace(pdf, cursor, 24);
    drawText("Notes", margin, cursor.y - 11, { size: 10, font: bold });
    cursor.y -= 14;
    drawWrapped(input.notes, margin, { size: 9, color: muted });
  }
  if (input.terms) {
    cursor.y -= 8;
    cursor = ensureSpace(pdf, cursor, 24);
    drawText("Terms", margin, cursor.y - 11, { size: 10, font: bold });
    cursor.y -= 14;
    drawWrapped(input.terms, margin, { size: 9, color: muted });
  }

  return await pdf.save();
}

export async function estimatePdf(opts: {
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
  currency?: string;
}): Promise<Uint8Array> {
  return buildDocumentPdf({
    org: opts.org,
    customer: opts.customer,
    docTitle: "ESTIMATE",
    number: opts.estimateNumber,
    meta: [
      ["Issue date", formatDate(opts.issueDate)],
      ["Expires", formatDate(opts.expiresAt)],
    ],
    items: opts.items,
    subtotal: opts.subtotal,
    discount: opts.discount,
    taxRate: opts.taxRate,
    tax: opts.tax,
    total: opts.total,
    notes: opts.notes,
    terms: opts.terms,
    currency: opts.currency,
  });
}

export async function invoicePdf(opts: {
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
}): Promise<Uint8Array> {
  return buildDocumentPdf({
    org: opts.org,
    customer: opts.customer,
    docTitle: "INVOICE",
    number: opts.invoiceNumber,
    meta: [
      ["Issue date", formatDate(opts.issueDate)],
      ["Due date", formatDate(opts.dueDate)],
    ],
    items: opts.items,
    subtotal: opts.subtotal,
    discount: opts.discount,
    taxRate: opts.taxRate,
    tax: opts.tax,
    total: opts.total,
    amountPaid: opts.amountPaid,
    balanceDue: opts.balanceDue,
    notes: opts.notes,
    terms: opts.terms,
    currency: opts.currency,
    paidStamp: opts.paid,
  });
}
