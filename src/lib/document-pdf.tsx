// Real PDF generation via @react-pdf/renderer. Mirrors the look of
// src/lib/document-html.ts but rendered to a true PDF buffer suitable for
// download, Drive upload, or email attachment. Runs on the Node runtime.
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";

type Org = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
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
type LineItem = { description: string; quantity: number; unit_price: number; total: number };

const palette = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  zebra: "#f8fafc",
  accent: "#2563eb",
  paid: "#16a34a",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: palette.text,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  orgName: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  orgAddress: { color: palette.muted, fontSize: 9, lineHeight: 1.45 },
  docTitle: { fontSize: 16, fontWeight: 700, marginBottom: 2, textAlign: "right" },
  docNumber: { color: palette.muted, fontSize: 11, textAlign: "right" },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, gap: 24 },
  partyLabel: { color: palette.muted, fontSize: 8, marginBottom: 2, letterSpacing: 1 },
  partyName: { fontWeight: 700, fontSize: 11 },
  partyContact: { color: palette.muted, fontSize: 9 },
  metaTable: { fontSize: 9 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  metaKey: { color: palette.muted },
  metaVal: { textAlign: "right" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: palette.zebra,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeaderCell: { fontSize: 9, fontWeight: 700 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: palette.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },
  totalsBlock: { marginTop: 10, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", width: 240, paddingVertical: 2 },
  totalsKey: { color: palette.muted },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 240,
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    fontWeight: 700,
    fontSize: 12,
  },
  balanceLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 240,
    paddingTop: 6,
    marginTop: 4,
    fontWeight: 700,
    color: palette.accent,
  },
  footerSplit: { flexDirection: "row", gap: 24, marginTop: 24 },
  footerCol: { flex: 1 },
  footerLabel: { fontWeight: 700, fontSize: 10, marginBottom: 3 },
  footerText: { fontSize: 9, color: palette.muted, lineHeight: 1.4 },
  paidStamp: {
    position: "absolute",
    top: 36,
    right: 36,
    transform: "rotate(-12deg)",
    borderWidth: 3,
    borderColor: palette.paid,
    color: palette.paid,
    fontWeight: 700,
    letterSpacing: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 22,
    borderRadius: 4,
  },
});

function Header({ org }: { org: Org }) {
  const addressLine = [org.address_line1, org.city, org.state, org.postal_code].filter(Boolean).join(", ");
  const contactLine = [org.phone, org.email].filter(Boolean).join(" • ");
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.orgName}>{org.name ?? "Your Business"}</Text>
        {addressLine ? <Text style={styles.orgAddress}>{addressLine}</Text> : null}
        {contactLine ? <Text style={styles.orgAddress}>{contactLine}</Text> : null}
      </View>
    </View>
  );
}

function PartiesAndMeta({
  docTitle,
  docNumber,
  customer,
  meta,
}: {
  docTitle: string;
  docNumber: string;
  customer: Customer;
  meta: [string, string][];
}) {
  return (
    <View>
      <View style={{ marginBottom: 8 }}>
        <Text style={styles.docTitle}>{docTitle}</Text>
        <Text style={styles.docNumber}>{docNumber}</Text>
      </View>
      <View style={styles.partiesRow}>
        <View>
          <Text style={styles.partyLabel}>BILL TO</Text>
          <Text style={styles.partyName}>{customerDisplayName(customer)}</Text>
          {customer.email ? <Text style={styles.partyContact}>{customer.email}</Text> : null}
          {customer.phone ? <Text style={styles.partyContact}>{customer.phone}</Text> : null}
        </View>
        <View style={styles.metaTable}>
          {meta.map(([k, v]) => (
            <View key={k} style={styles.metaRow}>
              <Text style={styles.metaKey}>{k}</Text>
              <Text style={styles.metaVal}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function LineTable({
  items,
  totals,
  currency = "USD",
}: {
  items: LineItem[];
  totals: {
    subtotal: number;
    discount?: number;
    taxRate?: number;
    tax?: number;
    total: number;
    paid?: number;
    balance?: number;
  };
  currency?: string;
}) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
        <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderCell, styles.colPrice]}>Price</Text>
        <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
      </View>
      {items.map((li, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.colDescription}>{li.description}</Text>
          <Text style={styles.colQty}>{li.quantity}</Text>
          <Text style={styles.colPrice}>{formatCurrency(li.unit_price, currency)}</Text>
          <Text style={[styles.colTotal, { fontWeight: 700 }]}>{formatCurrency(li.total, currency)}</Text>
        </View>
      ))}

      <View style={styles.totalsBlock}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsKey}>Subtotal</Text>
          <Text>{formatCurrency(totals.subtotal, currency)}</Text>
        </View>
        {totals.discount && totals.discount > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Discount</Text>
            <Text>− {formatCurrency(totals.discount, currency)}</Text>
          </View>
        ) : null}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsKey}>Tax ({((totals.taxRate ?? 0) * 100).toFixed(2)}%)</Text>
          <Text>{formatCurrency(totals.tax ?? 0, currency)}</Text>
        </View>
        <View style={styles.totalLine}>
          <Text>Total</Text>
          <Text>{formatCurrency(totals.total, currency)}</Text>
        </View>
        {typeof totals.paid === "number" ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Paid</Text>
            <Text>− {formatCurrency(totals.paid, currency)}</Text>
          </View>
        ) : null}
        {typeof totals.balance === "number" ? (
          <View style={styles.balanceLine}>
            <Text>Balance due</Text>
            <Text>{formatCurrency(totals.balance, currency)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Footer({ notes, terms }: { notes?: string | null; terms?: string | null }) {
  if (!notes && !terms) return null;
  return (
    <View style={styles.footerSplit}>
      {notes ? (
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>Notes</Text>
          <Text style={styles.footerText}>{notes}</Text>
        </View>
      ) : null}
      {terms ? (
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>Terms</Text>
          <Text style={styles.footerText}>{terms}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function EstimatePdfDoc(opts: {
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
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Header org={opts.org} />
        <PartiesAndMeta
          docTitle="Estimate"
          docNumber={opts.estimateNumber}
          customer={opts.customer}
          meta={[
            ["Issue date", formatDate(opts.issueDate)],
            ["Expires", formatDate(opts.expiresAt)],
          ]}
        />
        <LineTable
          items={opts.items}
          totals={{
            subtotal: opts.subtotal,
            discount: opts.discount,
            taxRate: opts.taxRate,
            tax: opts.tax,
            total: opts.total,
          }}
          currency={opts.currency}
        />
        <Footer notes={opts.notes} terms={opts.terms} />
      </Page>
    </Document>
  );
}

export function InvoicePdfDoc(opts: {
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
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {opts.paid ? <Text style={styles.paidStamp}>PAID</Text> : null}
        <Header org={opts.org} />
        <PartiesAndMeta
          docTitle={opts.paid ? "Receipt" : "Invoice"}
          docNumber={opts.invoiceNumber}
          customer={opts.customer}
          meta={[
            ["Issue date", formatDate(opts.issueDate)],
            ["Due date", formatDate(opts.dueDate)],
          ]}
        />
        <LineTable
          items={opts.items}
          totals={{
            subtotal: opts.subtotal,
            discount: opts.discount,
            taxRate: opts.taxRate,
            tax: opts.tax,
            total: opts.total,
            paid: opts.amountPaid,
            balance: opts.balanceDue,
          }}
          currency={opts.currency}
        />
        <Footer notes={opts.notes} terms={opts.terms} />
      </Page>
    </Document>
  );
}

export function estimatePdfBuffer(
  opts: Parameters<typeof EstimatePdfDoc>[0],
): Promise<Buffer> {
  return renderToBuffer(<EstimatePdfDoc {...opts} />);
}

export function invoicePdfBuffer(
  opts: Parameters<typeof InvoicePdfDoc>[0],
): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDoc {...opts} />);
}
