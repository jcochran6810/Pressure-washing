"use client";

import Link from "next/link";
import { BulkActionTable, type BulkActionDef, type Column } from "@/components/bulk-action-table";
import { customerDisplayName, formatCurrency, formatDateTime, statusColor } from "@/lib/utils";
import {
  bulkCancelJobs,
  bulkDeleteJobs,
  bulkMarkJobsCompleted,
  bulkMarkJobsInProgress,
  bulkMarkJobsScheduled,
  bulkSendJobReminders,
} from "./actions";

export type JobRow = {
  id: string;
  title: string;
  status: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  total_amount: number | null;
  customers: { first_name: string | null; last_name: string | null; company_name: string | null; email?: string | null } | null;
  properties: { address_line1: string | null; city: string | null; state: string | null } | null;
};

export function JobsList({ rows }: { rows: JobRow[] }) {
  const columns: Column<JobRow>[] = [
    {
      key: "title",
      header: "Job",
      render: (j) => (
        <div className="min-w-0">
          <Link href={`/jobs/${j.id}`} className="font-medium hover:text-brand-700">
            {j.title}
          </Link>
          {j.properties?.address_line1 && (
            <p className="text-xs text-gray-500 truncate">
              {j.properties.address_line1}
              {j.properties.city ? `, ${j.properties.city}` : ""}
            </p>
          )}
        </div>
      ),
    },
    { key: "customer", header: "Customer", render: (j) => customerDisplayName(j.customers ?? {}) },
    {
      key: "scheduled",
      header: "Scheduled",
      headerClass: "hidden sm:table-cell",
      cellClass: "hidden sm:table-cell text-gray-500 whitespace-nowrap",
      render: (j) => formatDateTime(j.scheduled_start),
    },
    {
      key: "total",
      header: "Total",
      cellClass: "font-medium",
      render: (j) => (Number(j.total_amount) > 0 ? formatCurrency(Number(j.total_amount)) : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (j) => <span className={`badge ${statusColor(j.status)}`}>{(j.status ?? "").replace("_", " ")}</span>,
    },
  ];

  const actions: BulkActionDef[] = [
    {
      key: "remind",
      label: "Send reminder to customer",
      busyLabel: "Sending…",
      tone: "primary",
      successTitle: "Reminders sent",
      run: bulkSendJobReminders,
    },
    {
      key: "start",
      label: "Mark in progress",
      busyLabel: "Updating…",
      successTitle: "Jobs started",
      run: bulkMarkJobsInProgress,
      disabledForRow: (j: JobRow) => (j.status === "in_progress" ? "already in progress" : null),
    },
    {
      key: "complete",
      label: "Mark completed",
      busyLabel: "Completing…",
      successTitle: "Jobs completed",
      run: bulkMarkJobsCompleted,
      disabledForRow: (j: JobRow) => (j.status === "completed" ? "already completed" : null),
    },
    {
      key: "reschedule",
      label: "Mark scheduled",
      busyLabel: "Updating…",
      successTitle: "Jobs rescheduled",
      run: bulkMarkJobsScheduled,
      disabledForRow: (j: JobRow) => (j.status === "scheduled" ? "already scheduled" : null),
    },
    {
      key: "cancel",
      label: "Cancel",
      busyLabel: "Cancelling…",
      successTitle: "Jobs cancelled",
      confirm: (count) => `Cancel ${count} job${count === 1 ? "" : "s"}?`,
      run: bulkCancelJobs,
      disabledForRow: (j: JobRow) => (j.status === "cancelled" ? "already cancelled" : null),
    },
    {
      key: "delete",
      label: "Delete",
      busyLabel: "Deleting…",
      tone: "danger",
      confirm: (count) => `Delete ${count} job${count === 1 ? "" : "s"}? This cannot be undone.`,
      successTitle: "Jobs deleted",
      run: bulkDeleteJobs,
    },
  ];

  return (
    <BulkActionTable
      rows={rows}
      columns={columns}
      actions={actions}
      itemNoun="job"
      rowHref={(j) => `/jobs/${j.id}`}
    />
  );
}
