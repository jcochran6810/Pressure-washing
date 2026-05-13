"use client";

import Link from "next/link";
import { BulkActionTable, type BulkActionDef, type Column } from "@/components/bulk-action-table";
import { customerDisplayName, formatCurrency, formatDate } from "@/lib/utils";
import {
  bulkDeleteReceipts,
  bulkEmailReceiptsToCustomers,
  bulkSaveReceiptsToDrive,
} from "./actions";

export type PaymentRow = {
  id: string;
  amount: number | null;
  payment_method: string | null;
  payment_date: string | null;
  reference_number: string | null;
  customers: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
  invoices: { id: string; invoice_number: string } | null;
};

export function PaymentsList({ rows }: { rows: PaymentRow[] }) {
  const columns: Column<PaymentRow>[] = [
    { key: "date", header: "Date", render: (p) => formatDate(p.payment_date) },
    { key: "customer", header: "Customer", render: (p) => customerDisplayName(p.customers ?? {}) },
    {
      key: "invoice",
      header: "Invoice",
      render: (p) =>
        p.invoices ? (
          <Link href={`/invoices/${p.invoices.id}`} className="hover:text-brand-700">
            {p.invoices.invoice_number}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "method", header: "Method", cellClass: "capitalize", render: (p) => p.payment_method ?? "—" },
    { key: "reference", header: "Reference", cellClass: "text-gray-600", render: (p) => p.reference_number || "—" },
    {
      key: "amount",
      header: "Amount",
      headerClass: "text-right",
      cellClass: "text-right font-medium",
      render: (p) => formatCurrency(Number(p.amount)),
    },
  ];

  const actions: BulkActionDef[] = [
    {
      key: "email",
      label: "Send to customer",
      busyLabel: "Sending…",
      tone: "primary",
      successTitle: "Receipts emailed",
      run: bulkEmailReceiptsToCustomers,
    },
    {
      key: "drive",
      label: "Save to Drive",
      busyLabel: "Uploading…",
      successTitle: "Saved to Drive",
      run: bulkSaveReceiptsToDrive,
    },
    {
      key: "delete",
      label: "Delete",
      busyLabel: "Deleting…",
      tone: "danger",
      confirm: (count) =>
        `Delete ${count} receipt${count === 1 ? "" : "s"}? Invoice balances will be recalculated.`,
      successTitle: "Receipts deleted",
      run: bulkDeleteReceipts,
    },
  ];

  return (
    <BulkActionTable
      rows={rows}
      columns={columns}
      actions={actions}
      itemNoun="receipt"
      rowHref={(p) => (p.invoices ? `/invoices/${p.invoices.id}` : null)}
    />
  );
}
