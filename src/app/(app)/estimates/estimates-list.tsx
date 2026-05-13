"use client";

import Link from "next/link";
import { BulkActionTable, type BulkActionDef, type Column } from "@/components/bulk-action-table";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import {
  bulkDeleteEstimates,
  bulkEmailEstimatesToCustomers,
  bulkSaveEstimatesToDrive,
} from "./actions";

export type EstimateRow = {
  id: string;
  estimate_number: string;
  status: string | null;
  issue_date: string | null;
  expires_at: string | null;
  total: number | null;
  customers: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
};

export function EstimatesList({ rows }: { rows: EstimateRow[] }) {
  const columns: Column<EstimateRow>[] = [
    {
      key: "number",
      header: "Number",
      render: (e) => (
        <Link href={`/estimates/${e.id}`} className="font-medium hover:text-brand-700">
          {e.estimate_number}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", render: (e) => customerDisplayName(e.customers ?? {}) },
    {
      key: "issued",
      header: "Issued",
      headerClass: "hidden sm:table-cell",
      cellClass: "hidden sm:table-cell text-gray-500",
      render: (e) => formatDate(e.issue_date),
    },
    {
      key: "total",
      header: "Total",
      cellClass: "font-medium",
      render: (e) => formatCurrency(Number(e.total)),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <span className={`badge ${statusColor(e.status)}`}>{e.status}</span>,
    },
  ];

  const actions: BulkActionDef[] = [
    {
      key: "email",
      label: "Send to customer",
      busyLabel: "Sending…",
      tone: "primary",
      successTitle: "Estimates emailed",
      run: bulkEmailEstimatesToCustomers,
    },
    {
      key: "drive",
      label: "Save to Drive",
      busyLabel: "Uploading…",
      successTitle: "Saved to Drive",
      run: bulkSaveEstimatesToDrive,
    },
    {
      key: "delete",
      label: "Delete",
      busyLabel: "Deleting…",
      tone: "danger",
      confirm: (count) => `Delete ${count} estimate${count === 1 ? "" : "s"}? This cannot be undone.`,
      successTitle: "Estimates deleted",
      run: bulkDeleteEstimates,
    },
  ];

  return <BulkActionTable rows={rows} columns={columns} actions={actions} itemNoun="estimate" />;
}
