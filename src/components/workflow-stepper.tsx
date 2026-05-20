"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { WorkflowState } from "@/lib/workflow";

type StepState = "done" | "current" | "pending" | "skipped";

type Step = {
  label: string;
  detail?: string;
  state: StepState;
  href?: string;
};

export function WorkflowStepper({ workflow }: { workflow: WorkflowState }) {
  const steps = buildSteps(workflow);
  const currentIdx = steps.findIndex((s) => s.state === "current");
  const next = currentIdx >= 0 ? steps[currentIdx] : null;
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  // Whenever workflow state changes, keep the active step inside the visible
  // slider so the user can always see where they are in the process.
  useEffect(() => {
    const li = currentRef.current;
    const ol = listRef.current;
    if (!li || !ol) return;
    const liRect = li.getBoundingClientRect();
    const olRect = ol.getBoundingClientRect();
    // Centre the current pill horizontally within the scroll container.
    const offsetLeft = li.offsetLeft - (ol.clientWidth - liRect.width) / 2;
    ol.scrollTo({ left: Math.max(0, offsetLeft), behavior: "smooth" });
  }, [currentIdx, workflow.estimateStatus, workflow.jobStatus, workflow.invoiceStatus, workflow.receiptSent]);

  return (
    <div className="card mb-4">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-sm">Workflow</h2>
        {next && (
          <span className="text-xs text-brand-700 font-medium">
            Next: {next.label}
            {next.detail ? ` — ${next.detail}` : ""}
          </span>
        )}
      </div>
      <ol ref={listRef} className="px-3 py-3 flex gap-1 overflow-x-auto scroll-smooth">
        {steps.map((step, i) => (
          <li
            key={step.label}
            ref={step.state === "current" ? currentRef : undefined}
            className="flex items-center gap-1 shrink-0"
          >
            <StepNode step={step} index={i} />
            {i < steps.length - 1 && (
              <span
                className={
                  step.state === "done"
                    ? "h-px w-4 sm:w-6 bg-green-400"
                    : "h-px w-4 sm:w-6 bg-gray-200"
                }
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepNode({ step, index }: { step: Step; index: number }) {
  const base = "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs whitespace-nowrap";
  const cls =
    step.state === "done"
      ? "bg-green-50 text-green-700 border border-green-200"
      : step.state === "current"
        ? "bg-brand-50 text-brand-800 border border-brand-300 ring-1 ring-brand-200"
        : step.state === "skipped"
          ? "bg-gray-50 text-gray-400 border border-gray-200 line-through"
          : "bg-gray-50 text-gray-500 border border-gray-200";
  const icon =
    step.state === "done" ? "✓" : step.state === "current" ? index + 1 : index + 1;
  const inner = (
    <span className={`${base} ${cls}`}>
      <span className="w-4 h-4 rounded-full bg-white border border-current grid place-items-center text-[10px] font-bold">
        {icon}
      </span>
      {step.label}
    </span>
  );
  return step.href ? <Link href={step.href}>{inner}</Link> : inner;
}

function buildSteps(w: WorkflowState): Step[] {
  const declinedShortCircuit = w.estimateDeclined;
  const estimateHref = w.estimateId ? `/estimates/${w.estimateId}` : undefined;
  const jobHref = w.jobId ? `/jobs/${w.jobId}` : undefined;
  const invoiceHref = w.invoiceId ? `/invoices/${w.invoiceId}` : undefined;

  // Step 1: Estimate created
  const estimateCreated: Step = {
    label: "Estimate created",
    detail: w.estimateNumber ?? undefined,
    state: w.estimateId ? "done" : "current",
    href: estimateHref,
  };

  // Step 2: Sent to customer
  const sent: Step = {
    label: "Sent to customer",
    state: declinedShortCircuit
      ? "done"
      : w.estimateSent
        ? "done"
        : w.estimateId
          ? "current"
          : "pending",
    href: estimateHref,
  };

  // Step 3: Customer approves
  const approved: Step = {
    label: declinedShortCircuit ? "Declined" : "Customer approves",
    state: declinedShortCircuit
      ? "skipped"
      : w.estimateAccepted
        ? "done"
        : w.estimateSent
          ? "current"
          : "pending",
    href: estimateHref,
  };

  // Step 4: Job created
  const jobCreated: Step = {
    label: "Job created",
    state: w.jobId ? "done" : declinedShortCircuit ? "skipped" : w.estimateAccepted ? "current" : "pending",
    href: jobHref,
  };

  // Step 5: Job scheduled
  const jobScheduled: Step = {
    label: "Job scheduled",
    state: w.jobScheduled
      ? "done"
      : w.jobId
        ? "current"
        : "pending",
    href: jobHref,
  };

  // Step 6: Job completed
  const jobCompleted: Step = {
    label: "Job completed",
    state: w.jobCompleted
      ? "done"
      : w.jobScheduled
        ? "current"
        : "pending",
    href: jobHref,
  };

  // Step 7: Invoice created
  const invoiceCreated: Step = {
    label: "Invoice created",
    detail: w.invoiceNumber ?? undefined,
    state: w.invoiceId ? "done" : w.jobCompleted ? "current" : "pending",
    href: invoiceHref,
  };

  // Step 8: Invoice sent
  const invoiceSent: Step = {
    label: "Sent with payment link",
    state: w.invoiceSent
      ? "done"
      : w.invoiceId
        ? "current"
        : "pending",
    href: invoiceHref,
  };

  // Step 9: Payment received
  const paid: Step = {
    label: "Paid",
    state: w.invoicePaid
      ? "done"
      : w.invoiceSent
        ? "current"
        : "pending",
    href: invoiceHref,
  };

  // Step 10: Receipt sent
  const receipt: Step = {
    label: "Receipt sent",
    state: w.receiptSent
      ? "done"
      : w.invoicePaid
        ? "current"
        : "pending",
    href: invoiceHref,
  };

  // Step 11: Complete
  const complete: Step = {
    label: "Complete",
    state: w.invoicePaid && w.receiptSent ? "done" : "pending",
  };

  return [
    estimateCreated,
    sent,
    approved,
    jobCreated,
    jobScheduled,
    jobCompleted,
    invoiceCreated,
    invoiceSent,
    paid,
    receipt,
    complete,
  ];
}
