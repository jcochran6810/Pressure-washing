"use server";

import { getSessionAndOrg } from "@/lib/org";
import { toCsv } from "@/lib/csv";
import { pushCustomerToQbo, pushInvoiceToQbo, type QboConn } from "@/lib/qbo";
import { revalidatePath } from "next/cache";

type Range = { from?: string | null; to?: string | null };

async function buildRange(formData: FormData): Promise<Range> {
  return {
    from: String(formData.get("from") || "") || null,
    to: String(formData.get("to") || "") || null,
  };
}

// Returns a CSV string for download via Server Action.
// (Next.js server actions can return strings; the client triggers a Blob download.)
export async function exportInvoicesCsv(formData: FormData): Promise<string> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const range = await buildRange(formData);
  let q = supabase
    .from("invoices")
    .select("invoice_number, issue_date, due_date, status, subtotal, tax_amount, discount_amount, total, amount_paid, balance_due, customers(first_name, last_name, company_name, email)")
    .eq("organization_id", organizationId)
    .order("issue_date");
  if (range.from) q = q.gte("issue_date", range.from);
  if (range.to) q = q.lte("issue_date", range.to);
  const { data } = await q;
  const rows = (data ?? []).map((r: any) => ({
    InvoiceNumber: r.invoice_number,
    IssueDate: r.issue_date,
    DueDate: r.due_date,
    Status: r.status,
    Customer: r.customers?.company_name || [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(" "),
    CustomerEmail: r.customers?.email ?? "",
    Subtotal: r.subtotal ?? 0,
    Discount: r.discount_amount ?? 0,
    Tax: r.tax_amount ?? 0,
    Total: r.total ?? 0,
    AmountPaid: r.amount_paid ?? 0,
    BalanceDue: r.balance_due ?? 0,
  }));
  await (supabase as any).from("accounting_exports").insert({
    organization_id: organizationId,
    kind: "invoices",
    format: "csv",
    from_date: range.from,
    to_date: range.to,
    row_count: rows.length,
  });
  return toCsv(rows);
}

export async function exportPaymentsCsv(formData: FormData): Promise<string> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const range = await buildRange(formData);
  let q = supabase
    .from("payments")
    .select("payment_date, amount, payment_method, reference_number, notes, invoices(invoice_number), customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .order("payment_date");
  if (range.from) q = q.gte("payment_date", range.from);
  if (range.to) q = q.lte("payment_date", range.to);
  const { data } = await q;
  const rows = (data ?? []).map((r: any) => ({
    PaymentDate: r.payment_date,
    Amount: r.amount,
    Method: r.payment_method,
    Reference: r.reference_number ?? "",
    Invoice: r.invoices?.invoice_number ?? "",
    Customer: r.customers?.company_name || [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(" "),
    Notes: r.notes ?? "",
  }));
  await (supabase as any).from("accounting_exports").insert({
    organization_id: organizationId,
    kind: "payments",
    format: "csv",
    from_date: range.from,
    to_date: range.to,
    row_count: rows.length,
  });
  return toCsv(rows);
}

export async function exportExpensesCsv(formData: FormData): Promise<string> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const range = await buildRange(formData);
  let q = supabase
    .from("expenses")
    .select("expense_date, amount, description, vendor, payment_method, tax_deductible, expense_categories(name)")
    .eq("organization_id", organizationId)
    .order("expense_date");
  if (range.from) q = q.gte("expense_date", range.from);
  if (range.to) q = q.lte("expense_date", range.to);
  const { data } = await q;
  const rows = (data ?? []).map((r: any) => ({
    ExpenseDate: r.expense_date,
    Amount: r.amount,
    Description: r.description ?? "",
    Vendor: r.vendor ?? "",
    Method: r.payment_method ?? "",
    Category: r.expense_categories?.name ?? "",
    TaxDeductible: r.tax_deductible ? "Yes" : "No",
  }));
  await (supabase as any).from("accounting_exports").insert({
    organization_id: organizationId,
    kind: "expenses",
    format: "csv",
    from_date: range.from,
    to_date: range.to,
    row_count: rows.length,
  });
  return toCsv(rows);
}

export async function exportCustomersCsv(): Promise<string> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data } = await supabase
    .from("customers")
    .select("first_name, last_name, company_name, email, phone, mobile_phone, customer_type, lead_source, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []).map((r: any) => ({
    FirstName: r.first_name ?? "",
    LastName: r.last_name ?? "",
    Company: r.company_name ?? "",
    Email: r.email ?? "",
    Phone: r.phone ?? "",
    Mobile: r.mobile_phone ?? "",
    Type: r.customer_type ?? "",
    LeadSource: r.lead_source ?? "",
    Created: r.created_at,
  }));
  await (supabase as any).from("accounting_exports").insert({
    organization_id: organizationId,
    kind: "customers",
    format: "csv",
    row_count: rows.length,
  });
  return toCsv(rows);
}

export async function disconnectQbo() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("qbo_connections").delete().eq("organization_id", organizationId);
  revalidatePath("/accounting");
  revalidatePath("/settings");
}

export async function pushInvoiceToQboAction(invoiceId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: conn } = await (supabase as any)
    .from("qbo_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conn) throw new Error("Connect QuickBooks Online first.");
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_line_items(*)")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  const c: any = inv.customers;
  const customerQboId = await pushCustomerToQbo(supabase as any, conn as QboConn, c);
  await pushInvoiceToQbo(supabase as any, conn as QboConn, inv, customerQboId);
  await (supabase as any).from("accounting_exports").insert({
    organization_id: organizationId,
    kind: "qbo_push",
    format: "qbo",
    row_count: 1,
    notes: `Invoice ${(inv as any).invoice_number}`,
  });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/accounting");
}

export async function pushAllUnsyncedInvoicesToQbo() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: conn } = await (supabase as any)
    .from("qbo_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conn) throw new Error("Connect QuickBooks Online first.");

  const { data: invoices } = await (supabase as any)
    .from("invoices")
    .select("*, customers(*), invoice_line_items(*)")
    .eq("organization_id", organizationId)
    .is("qbo_id", null)
    .in("status", ["sent", "paid", "partial", "overdue"]);

  let pushed = 0;
  for (const inv of invoices ?? []) {
    try {
      const customerQboId = await pushCustomerToQbo(supabase as any, conn as QboConn, inv.customers);
      await pushInvoiceToQbo(supabase as any, conn as QboConn, inv, customerQboId);
      pushed += 1;
    } catch (e) {
      // continue with the rest
      console.error("QBO push failed for invoice", inv.id, e);
    }
  }
  await (supabase as any).from("accounting_exports").insert({
    organization_id: organizationId,
    kind: "qbo_push",
    format: "qbo",
    row_count: pushed,
    notes: `Bulk push (${pushed} invoices)`,
  });
  revalidatePath("/accounting");
}
