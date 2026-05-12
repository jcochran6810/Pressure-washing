import Link from "next/link";
import type { WorkflowState } from "@/lib/workflow";
import { CopyButton } from "./copy-button";
import { setEstimateStatus, emailEstimateToCustomer } from "@/app/(app)/estimates/actions";
import { setJobStatus, scheduleJob } from "@/app/(app)/jobs/actions";
import { emailInvoiceToCustomer, recordPayment, sendReceiptToCustomer } from "@/app/(app)/invoices/actions";

export function NextStepBanner({
  workflow,
  approvalToken,
  customerHasEmail,
}: {
  workflow: WorkflowState;
  approvalToken?: string | null;
  customerHasEmail?: boolean;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  // Terminal states
  if (workflow.estimateDeclined) {
    return (
      <Banner tone="muted" eyebrow="Workflow halted" title="Estimate declined">
        <p className="text-sm text-gray-600">
          The customer declined this estimate. You can create a revised estimate any time.
        </p>
        <Link href="/estimates/new" className="btn-primary mt-3">+ New estimate</Link>
      </Banner>
    );
  }

  if (workflow.invoicePaid && workflow.receiptSent) {
    return (
      <Banner tone="success" eyebrow="Complete" title="🎉 Workflow complete">
        <p className="text-sm text-gray-700">
          Invoice paid and receipt delivered. Nothing left to do here.
        </p>
      </Banner>
    );
  }

  // Step 2: estimate not yet sent
  if (workflow.estimateId && !workflow.estimateSent && !workflow.estimateAccepted) {
    const emailEst = workflow.estimateId ? emailEstimateToCustomer.bind(null, workflow.estimateId) : null;
    const markSent = workflow.estimateId ? setEstimateStatus.bind(null, workflow.estimateId, "sent") : null;
    return (
      <Banner tone="primary" eyebrow="Next step" title="Send the estimate to your customer">
        <p className="text-sm text-gray-700 mb-3">
          Emails a clean estimate document, marks it as sent, and unlocks the digital approval link.
        </p>
        <div className="flex flex-wrap gap-2">
          {emailEst && (
            <form action={emailEst}>
              <button className="btn-primary text-base px-5 py-3" disabled={!customerHasEmail}>
                ✉ Email estimate to customer
              </button>
            </form>
          )}
          {markSent && (
            <form action={markSent}>
              <button className="btn-secondary">Mark sent manually</button>
            </form>
          )}
        </div>
        {!customerHasEmail && <p className="text-xs text-amber-700 mt-2">Customer has no email — add one to enable sending.</p>}
      </Banner>
    );
  }

  // Step 3: estimate sent, waiting on customer
  if (workflow.estimateId && workflow.estimateSent && !workflow.estimateAccepted) {
    const markAccepted = setEstimateStatus.bind(null, workflow.estimateId, "accepted");
    const quoteUrl = approvalToken ? `${baseUrl}/quote/${approvalToken}` : null;
    return (
      <Banner tone="warning" eyebrow="Waiting on customer" title="Awaiting customer approval">
        <p className="text-sm text-gray-700 mb-3">
          The customer can approve at the link below. Once they do, an open job is created automatically.
        </p>
        {quoteUrl && (
          <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-200 rounded-md p-2 mb-3 text-xs">
            <a href={quoteUrl} target="_blank" rel="noopener" className="text-brand-700 underline break-all flex-1">
              {quoteUrl}
            </a>
            <CopyButton value={quoteUrl} />
          </div>
        )}
        <form action={markAccepted}>
          <button className="btn-primary">Mark accepted manually</button>
        </form>
      </Banner>
    );
  }

  // Step 5: job exists but not scheduled
  if (workflow.jobId && !workflow.jobScheduled && !workflow.jobInProgress && !workflow.jobCompleted) {
    const schedule = scheduleJob.bind(null, workflow.jobId);
    return (
      <Banner tone="primary" eyebrow="Next step" title="Schedule this job">
        <p className="text-sm text-gray-700 mb-3">Pick a start time. The customer gets an appointment reminder before it.</p>
        <form action={schedule} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs">Start</label>
            <input name="scheduled_start" type="datetime-local" required className="block" />
          </div>
          <div>
            <label className="text-xs">End (optional)</label>
            <input name="scheduled_end" type="datetime-local" className="block" />
          </div>
          <button className="btn-primary text-base px-5 py-3">📅 Schedule job</button>
        </form>
      </Banner>
    );
  }

  // Step 6a: scheduled, not yet started
  if (workflow.jobId && workflow.jobScheduled && !workflow.jobInProgress && !workflow.jobCompleted) {
    const start = setJobStatus.bind(null, workflow.jobId, "in_progress");
    return (
      <Banner tone="primary" eyebrow="On the day of the job" title="Start the job">
        <p className="text-sm text-gray-700 mb-3">Once you're on-site, hit start to log the work time.</p>
        <div className="flex flex-wrap gap-2">
          <form action={start}>
            <button className="btn-primary text-base px-5 py-3">▶ Start job</button>
          </form>
          <Link href={`/jobs/${workflow.jobId}`} className="btn-secondary">View job details</Link>
        </div>
      </Banner>
    );
  }

  // Step 6b: in progress
  if (workflow.jobId && workflow.jobInProgress) {
    const complete = setJobStatus.bind(null, workflow.jobId, "completed");
    return (
      <Banner tone="primary" eyebrow="Job in progress" title="Mark job completed when done">
        <p className="text-sm text-gray-700 mb-3">
          Marking complete auto-drafts the invoice from this job. Take after photos first if you haven't already.
        </p>
        <form action={complete}>
          <button className="btn-primary text-base px-5 py-3">✓ Mark job completed</button>
        </form>
      </Banner>
    );
  }

  // Step 8: invoice draft not yet sent
  if (workflow.invoiceId && !workflow.invoiceSent && !workflow.invoicePaid) {
    const emailInv = emailInvoiceToCustomer.bind(null, workflow.invoiceId);
    return (
      <Banner tone="primary" eyebrow="Next step" title="Send the invoice with payment link">
        <p className="text-sm text-gray-700 mb-3">
          Creates the Stripe payment link if Stripe is connected, includes a "Pay online" button in the email,
          and marks the invoice as sent.
        </p>
        <form action={emailInv}>
          <button className="btn-primary text-base px-5 py-3" disabled={!customerHasEmail}>
            ✉ Send invoice to customer
          </button>
        </form>
        {!customerHasEmail && <p className="text-xs text-amber-700 mt-2">Customer has no email — add one to enable sending.</p>}
      </Banner>
    );
  }

  // Step 9: invoice sent, awaiting payment
  if (workflow.invoiceId && workflow.invoiceSent && !workflow.invoicePaid) {
    const record = recordPayment.bind(null, workflow.invoiceId);
    return (
      <Banner tone="warning" eyebrow="Awaiting payment" title="Waiting for the customer to pay">
        <p className="text-sm text-gray-700 mb-3">
          {workflow.hasStripeLink
            ? "We're watching for Stripe to confirm payment automatically. If you collected cash, check, or card in person, log it below."
            : "If you collected the payment in person, log it below."}
        </p>
        <form action={record} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs">Amount</label>
            <input name="amount" type="number" step="0.01" min="0" required className="w-full" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs">Date</label>
            <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs">Method</label>
            <select name="payment_method" className="w-full">
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
              <option value="ach">ACH</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button className="btn-primary text-base col-span-2 sm:col-span-1">💰 Record payment</button>
        </form>
      </Banner>
    );
  }

  // Step 11 fallback: paid but no receipt logged yet (rare — receipt sends automatically on payment record)
  if (workflow.invoicePaid && !workflow.receiptSent) {
    const sendReceipt = workflow.invoiceId ? sendReceiptToCustomer.bind(null, workflow.invoiceId) : null;
    return (
      <Banner tone="primary" eyebrow="Last step" title="Send the receipt">
        <p className="text-sm text-gray-700 mb-3">Send the customer a copy stamped PAID.</p>
        {sendReceipt && (
          <form action={sendReceipt}>
            <button className="btn-primary text-base px-5 py-3" disabled={!customerHasEmail}>✉ Send receipt</button>
          </form>
        )}
        {!customerHasEmail && <p className="text-xs text-amber-700 mt-2">Customer has no email — add one to enable sending.</p>}
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  eyebrow,
  title,
  children,
}: {
  tone: "primary" | "warning" | "success" | "muted";
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "primary"
      ? "bg-brand-50 border-brand-300 ring-1 ring-brand-200"
      : tone === "warning"
        ? "bg-amber-50 border-amber-300"
        : tone === "success"
          ? "bg-green-50 border-green-300"
          : "bg-gray-50 border-gray-300";
  const eyebrowColor =
    tone === "primary"
      ? "text-brand-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "success"
          ? "text-green-700"
          : "text-gray-600";
  return (
    <div className={`card-padded ${cls} mb-4`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${eyebrowColor}`}>{eyebrow}</p>
      <h2 className="text-lg sm:text-xl font-bold mt-0.5 mb-2">{title}</h2>
      {children}
    </div>
  );
}
