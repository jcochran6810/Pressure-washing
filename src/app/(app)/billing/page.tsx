import { getSessionAndOrg } from "@/lib/org";
import { daysLeftInTrial, isSubscriptionActive } from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import { SubscribeButton, PortalButton, CancelButtons } from "./billing-buttons";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ subscription?: string }> }) {
  const { organization } = await getSessionAndOrg();
  const { subscription } = await searchParams;

  const status = organization?.subscription_status ?? "trialing";
  const subId = (organization as any)?.subscription_stripe_id ?? null;
  const customerId = (organization as any)?.subscription_customer_id ?? null;
  const periodEnd = (organization as any)?.subscription_current_period_end ?? null;
  const trialEnd = (organization as any)?.trial_ends_at ?? null;
  const trialDays = daysLeftInTrial(organization as any);
  const active = isSubscriptionActive(organization as any);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-5">Billing</h1>

      {subscription === "ok" && (
        <Notice tone="ok">Subscription started. Welcome aboard.</Notice>
      )}
      {subscription === "cancelled" && (
        <Notice tone="info">Checkout cancelled. You can subscribe any time.</Notice>
      )}

      <section className="card-padded mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Plan</p>
            <p className="text-xl font-semibold">{(organization as any)?.subscription_plan ?? "Starter"}</p>
            <StatusBadge status={status} />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cost</p>
            <p className="text-xl font-semibold">$49 <span className="text-sm text-gray-500 font-normal">/ month</span></p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
          {status === "trialing" && (
            <Field
              label="Trial ends"
              value={trialEnd ? formatDate(trialEnd) : "—"}
              hint={trialDays !== null ? `${trialDays} day${trialDays === 1 ? "" : "s"} left` : undefined}
            />
          )}
          {periodEnd && (
            <Field label="Current period ends" value={formatDate(periodEnd)} />
          )}
        </div>
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">What&apos;s included</h2>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>✓ Unlimited customers, jobs, estimates, invoices</li>
          <li>✓ Stripe payment links + Connect for direct payouts</li>
          <li>✓ Email + SMS templates (Resend / Telnyx)</li>
          <li>✓ Drag-and-drop calendar with appointment reminders</li>
          <li>✓ Recurring contract scheduling + Stripe subscriptions</li>
          <li>✓ Customer portal, audit log, in-app notifications</li>
          <li>✓ Satellite measurement, photo annotations, before/after galleries</li>
          <li>✓ QuickBooks Online sync, CSV exports, tax form summaries</li>
        </ul>
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Manage subscription</h2>
        {!stripeConfigured ? (
          <p className="text-sm text-red-700">Stripe isn&apos;t configured. Set STRIPE_SECRET_KEY in your environment.</p>
        ) : !subId ? (
          <>
            <p className="text-sm text-gray-600 mb-3">
              {status === "trialing"
                ? `You're on a free trial${trialDays !== null ? ` — ${trialDays} day${trialDays === 1 ? "" : "s"} left.` : "."} Subscribe now to keep access after the trial ends.`
                : status === "past_due"
                ? "Your trial has ended or your last payment failed. Subscribe to restore full access."
                : status === "cancelled"
                ? "Your subscription was cancelled. Resubscribe any time."
                : "Subscribe to unlock full access."}
            </p>
            <SubscribeButton />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">
              Update your payment method, view past invoices, or cancel — all through Stripe&apos;s secure portal.
            </p>
            <div className="flex flex-wrap gap-2">
              <PortalButton hasCustomer={!!customerId} />
              <CancelButtons
                subscriptionId={subId}
                cancelAtPeriodEnd={Boolean((organization as any)?.cancel_at_period_end)}
              />
            </div>
          </>
        )}
      </section>

      <p className="text-xs text-gray-500">
        Subscription billing is processed by Stripe. We never see or store your card details.
        Questions? Email support — every reply is read by a real person.
      </p>
    </div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-medium">{value}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active" ? "bg-green-100 text-green-800" :
    status === "trialing" ? "bg-blue-100 text-blue-800" :
    status === "past_due" ? "bg-amber-100 text-amber-800" :
    status === "cancelled" ? "bg-red-100 text-red-800" :
    "bg-gray-100 text-gray-700";
  return <span className={`badge mt-2 ${tone} capitalize`}>{status.replace("_", " ")}</span>;
}

function Notice({ tone, children }: { tone: "ok" | "info" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "ok" ? "bg-green-50 text-green-800 border-green-200" :
    tone === "info" ? "bg-blue-50 text-blue-800 border-blue-200" :
    "bg-red-50 text-red-800 border-red-200";
  return <div className={`border rounded-md p-3 text-sm mb-4 ${cls}`}>{children}</div>;
}
