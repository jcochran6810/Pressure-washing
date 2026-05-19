// Per-job workflow checklist for the send log. Each row covers a single
// job's lifecycle in nine timestamps so the operator can spot stalled
// deals (estimate sent but never approved, job completed but invoice
// never sent, paid but receipt never sent) at a glance.

import Link from "next/link";
import { customerDisplayName, formatDate } from "@/lib/utils";

export type WorkflowRow = {
  jobId: string;
  jobNumber: string | null;
  customerName: string;
  customerHref: string | null;
  estimateId: string | null;
  invoiceId: string | null;

  // Timestamps drive the column rendering. Null = step hasn't happened.
  estimateStartedAt: string | null;
  estimateSentAt: string | null;
  estimateApprovedAt: string | null;
  jobScheduledAt: string | null;
  jobCompletedAt: string | null;
  invoiceCreatedAt: string | null;
  invoiceSentAt: string | null;
  paidAt: string | null;
  receiptSentAt: string | null;
};

const STEP_HEADERS: { key: keyof WorkflowRow; label: string }[] = [
  { key: "estimateStartedAt", label: "Est started" },
  { key: "estimateSentAt", label: "Est sent" },
  { key: "estimateApprovedAt", label: "Approved" },
  { key: "jobScheduledAt", label: "Job scheduled" },
  { key: "jobCompletedAt", label: "Completed" },
  { key: "invoiceCreatedAt", label: "Invoice drafted" },
  { key: "invoiceSentAt", label: "Invoice sent" },
  { key: "paidAt", label: "Paid" },
  { key: "receiptSentAt", label: "Receipt sent" },
];

function StepCell({ value }: { value: string | null }) {
  if (!value) {
    return (
      <td className="px-2 py-2 text-center text-gray-300 text-xs whitespace-nowrap">—</td>
    );
  }
  return (
    <td className="px-2 py-2 text-center whitespace-nowrap">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-green-600 text-xs leading-none">✓</span>
        <span className="text-[10px] text-gray-600">{formatDate(value)}</span>
      </div>
    </td>
  );
}

export function WorkflowChecklist({ rows }: { rows: WorkflowRow[] }) {
  if (!rows.length) {
    return (
      <div className="card-padded text-sm text-gray-500 text-center mb-4">
        No active jobs yet. Once you start an estimate, the workflow shows up here.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto mb-6">
      <table className="data-table min-w-full text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 text-left">Customer / job</th>
            {STEP_HEADERS.map((h) => (
              <th key={h.key as string} className="px-2 text-center text-[11px] uppercase tracking-wider">
                {h.label}
              </th>
            ))}
            <th className="px-2 text-center text-[11px] uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const done = r.receiptSentAt && r.paidAt;
            const statusLabel = done
              ? "Workflow complete"
              : r.paidAt
                ? "Paid — receipt pending"
                : r.invoiceSentAt
                  ? "Awaiting payment"
                  : r.invoiceCreatedAt
                    ? "Invoice drafted"
                    : r.jobCompletedAt
                      ? "Job done — invoice next"
                      : r.jobScheduledAt
                        ? "Job in progress"
                        : r.estimateApprovedAt
                          ? "Approved — schedule job"
                          : r.estimateSentAt
                            ? "Awaiting customer approval"
                            : r.estimateStartedAt
                              ? "Estimate draft"
                              : "—";
            const statusTone = done
              ? "bg-green-100 text-green-800"
              : r.paidAt
                ? "bg-amber-100 text-amber-800"
                : r.invoiceSentAt
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-700";
            return (
              <tr key={r.jobId} className="align-middle">
                <td className="sticky left-0 bg-white z-10 px-3 py-2 min-w-[200px]">
                  <div className="font-medium text-gray-900">
                    {r.customerHref ? (
                      <Link href={r.customerHref} className="hover:text-brand-700 hover:underline">
                        {r.customerName}
                      </Link>
                    ) : (
                      r.customerName
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    <Link href={`/jobs/${r.jobId}`} className="hover:underline">
                      {r.jobNumber ?? "Job"}
                    </Link>
                  </div>
                </td>
                {STEP_HEADERS.map((h) => (
                  <StepCell key={h.key as string} value={(r[h.key] as string | null) ?? null} />
                ))}
                <td className="px-2 py-2 text-center">
                  <span className={`badge text-[11px] ${statusTone}`}>{statusLabel}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
