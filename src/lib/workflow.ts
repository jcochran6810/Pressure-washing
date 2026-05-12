import { createClient } from "@/lib/supabase/server";

export type WorkflowState = {
  estimateId: string | null;
  estimateNumber: string | null;
  estimateStatus: string | null;
  estimateSent: boolean;
  estimateAccepted: boolean;
  estimateDeclined: boolean;

  jobId: string | null;
  jobStatus: string | null;
  jobScheduled: boolean;
  jobInProgress: boolean;
  jobCompleted: boolean;

  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  invoiceSent: boolean;
  hasStripeLink: boolean;
  invoicePaid: boolean;

  receiptSent: boolean;
};

const EMPTY: WorkflowState = {
  estimateId: null, estimateNumber: null, estimateStatus: null,
  estimateSent: false, estimateAccepted: false, estimateDeclined: false,
  jobId: null, jobStatus: null, jobScheduled: false, jobInProgress: false, jobCompleted: false,
  invoiceId: null, invoiceNumber: null, invoiceStatus: null,
  invoiceSent: false, hasStripeLink: false, invoicePaid: false,
  receiptSent: false,
};

export async function loadWorkflow({
  estimateId, jobId, invoiceId,
}: { estimateId?: string; jobId?: string; invoiceId?: string }): Promise<WorkflowState> {
  const supabase = await createClient();
  let state = { ...EMPTY };

  // Resolve the chain from whichever anchor we have
  let est: any = null;
  let job: any = null;
  let inv: any = null;

  if (estimateId) {
    est = (await supabase.from("estimates").select("id, estimate_number, status, sent_at, accepted_at").eq("id", estimateId).maybeSingle()).data;
    job = (await supabase.from("jobs").select("id, status, scheduled_start, actual_start, actual_end").eq("estimate_id", estimateId).maybeSingle()).data;
    if (job?.id) {
      inv = (await supabase.from("invoices").select("id, invoice_number, status, sent_at, paid_at, stripe_payment_link, balance_due").eq("job_id", job.id).maybeSingle()).data;
    }
    if (!inv) {
      inv = (await supabase.from("invoices").select("id, invoice_number, status, sent_at, paid_at, stripe_payment_link, balance_due").eq("estimate_id", estimateId).maybeSingle()).data;
    }
  } else if (jobId) {
    job = (await supabase.from("jobs").select("id, estimate_id, status, scheduled_start, actual_start, actual_end").eq("id", jobId).maybeSingle()).data;
    if (job?.estimate_id) {
      est = (await supabase.from("estimates").select("id, estimate_number, status, sent_at, accepted_at").eq("id", job.estimate_id).maybeSingle()).data;
    }
    inv = (await supabase.from("invoices").select("id, invoice_number, status, sent_at, paid_at, stripe_payment_link, balance_due").eq("job_id", jobId).maybeSingle()).data;
  } else if (invoiceId) {
    inv = (await supabase.from("invoices").select("id, invoice_number, status, sent_at, paid_at, stripe_payment_link, balance_due, job_id, estimate_id").eq("id", invoiceId).maybeSingle()).data;
    if (inv?.job_id) {
      job = (await supabase.from("jobs").select("id, estimate_id, status, scheduled_start, actual_start, actual_end").eq("id", inv.job_id).maybeSingle()).data;
    }
    const linkedEstId = inv?.estimate_id ?? job?.estimate_id;
    if (linkedEstId) {
      est = (await supabase.from("estimates").select("id, estimate_number, status, sent_at, accepted_at").eq("id", linkedEstId).maybeSingle()).data;
    }
  }

  if (est) {
    state.estimateId = est.id;
    state.estimateNumber = est.estimate_number;
    state.estimateStatus = est.status;
    state.estimateSent = !!est.sent_at;
    state.estimateAccepted = est.status === "accepted" || est.status === "converted";
    state.estimateDeclined = est.status === "declined";
  }
  if (job) {
    state.jobId = job.id;
    state.jobStatus = job.status;
    state.jobScheduled = !!job.scheduled_start;
    state.jobInProgress = job.status === "in_progress";
    state.jobCompleted = job.status === "completed";
  }
  if (inv) {
    state.invoiceId = inv.id;
    state.invoiceNumber = inv.invoice_number;
    state.invoiceStatus = inv.status;
    state.invoiceSent = !!inv.sent_at;
    state.hasStripeLink = !!inv.stripe_payment_link;
    state.invoicePaid = inv.status === "paid";

    if (inv.id) {
      const { count } = await supabase
        .from("receipt_log")
        .select("*", { count: "exact", head: true })
        .eq("invoice_id", inv.id);
      state.receiptSent = (count ?? 0) > 0;
    }
  }
  return state;
}
