"use client";

import Link from "next/link";
import { BulkActionTable, type BulkActionDef, type Column } from "@/components/bulk-action-table";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import {
  bulkDeleteInvoices,
  bulkEmailInvoicesToCustomers,
  bulkSaveInvoicesToDrive,
} from "./actions";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string | null;
  total: number | null;
  balance_due: number | null;
  due_date: string | null;
  issue_date: string | null;
  customers: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
};

export function InvoicesList({ rows }: { rows: InvoiceRow[] }) {
  const columns: Column<InvoiceRow>[] = [
    {
      key: "number",
      header: "Number",
      render: (i) => (
        <Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand-700">
          {i.invoice_number}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", render: (i) => customerDisplayName(i.customers ?? {}) },
    {
      key: "issued",
      header: "Issued",
      headerClass: "hidden sm:table-cell",
      cellClass: "hidden sm:table-cell text-gray-500",
      render: (i) => formatDate(i.issue_date),
    },
    {
      key: "due",
      header: "Due",
      headerClass: "hidden sm:table-cell",
      cellClass: "hidden sm:table-cell text-gray-500",
      render: (i) => formatDate(i.due_date),
    },
    { key: "total", header: "Total", cellClass: "font-medium", render: (i) => formatCurrency(Number(i.total)) },
    { key: "balance", header: "Balance", cellClass: "font-medium", render: (i) => formatCurrency(Number(i.balance_due)) },
    {
      key: "status",
      header: "Status",
      render: (i) => <span className={`badge ${statusColor(i.status)}`}>{i.status}</span>,
    },
  ];

  const actions: BulkActionDef[] = [
    {
      key: "email",
      label: "Send to customer",
      busyLabel: "Sending…",
      tone: "primary",
      successTitle: "Invoices emailed",
      run: bulkEmailInvoicesToCustomers,
    },
    {
      key: "drive",
      label: "Save to Drive",
      busyLabel: "Uploading…",
      successTitle: "Saved to Drive",
      run: bulkSaveInvoicesToDrive,
    },
    {
      key: "delete",
      label: "Delete",
      busyLabel: "Deleting…",
      tone: "danger",
      confirm: (count) => `Delete ${count} invoice${count === 1 ? "" : "s"}? This cannot be undone.`,
      successTitle: "Invoices deleted",
      run: bulkDeleteInvoices,
    },
  ];

  return (
    <BulkActionTable
      rows={rows}
      columns={columns}
      actions={actions}
      itemNoun="invoice"
      rowHref={(i) => `/invoices/${i.id}`}
    />
  );
}
