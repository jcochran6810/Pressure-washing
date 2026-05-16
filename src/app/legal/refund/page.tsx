import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "Refund Policy · Suds" };

export default function RefundPage() {
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <h2>Free trial</h2>
      <p>
        Every new account gets a 14-day free trial. No credit card is required to
        start the trial. If you don&apos;t convert, your account moves to read-only
        mode — your data stays accessible but you can&apos;t create new estimates,
        invoices, or send messages.
      </p>

      <h2>Subscription refunds</h2>
      <p>
        Suds is billed monthly in advance. Our default refund policy:
      </p>
      <ul>
        <li><strong>First 7 days of paid service:</strong> 100% refund, no questions asked. Email <strong>[SUPPORT EMAIL]</strong> with the subject &quot;Refund request&quot;.</li>
        <li><strong>After 7 days:</strong> we do not pro-rate refunds for partial months. Your subscription remains active through the end of the current billing period; you will not be charged for the next period.</li>
        <li><strong>Annual billing:</strong> not currently offered. (When we add annual plans, refunds will be pro-rated within the first 30 days only.)</li>
      </ul>

      <h2>Exceptions where we always refund</h2>
      <ul>
        <li>Duplicate or accidental charges.</li>
        <li>Unauthorized use of your card (subject to verification).</li>
        <li>Service unavailability exceeding 24 consecutive hours due to our error.</li>
        <li>Material billing error on our part.</li>
      </ul>

      <h2>Cancellation</h2>
      <p>You may cancel any time from <strong>Billing → Cancel subscription</strong> in the app. Cancellations take effect at the end of your current billing period — you retain full access until then.</p>

      <h2>What happens after cancellation</h2>
      <ul>
        <li>You retain read-only access to your data for 90 days.</li>
        <li>You may export your data during that window (Reports, Accounting → CSV exports).</li>
        <li>After 90 days, your data is permanently deleted from our active systems. Backups are purged within an additional 90 days.</li>
        <li>You may resubscribe within the 90-day window to restore full access; your data is preserved.</li>
      </ul>

      <h2>Chargebacks</h2>
      <p>
        Please contact us before disputing a charge — we resolve nearly every
        billing question by direct refund. Chargebacks initiated without prior
        contact may result in account suspension and a $25 chargeback fee passed
        through from Stripe.
      </p>

      <h2>Payments from your own customers (Stripe Connect)</h2>
      <p>
        Refunds you issue to your own customers (the people who hire you for
        pressure washing) are processed via Stripe Connect on your own connected
        account. Suds is not a party to those refunds. To refund a customer:
      </p>
      <ol>
        <li>Log into your Stripe Dashboard.</li>
        <li>Find the charge under Payments.</li>
        <li>Click &quot;Refund&quot;.</li>
      </ol>
      <p>
        Note: Suds&apos; subscription fees do <em>not</em> change based on refunds
        you issue to your own customers.
      </p>

      <h2>How to request a refund</h2>
      <p>Email <strong>[SUPPORT EMAIL]</strong> with:</p>
      <ol>
        <li>Your account email.</li>
        <li>The charge date and amount.</li>
        <li>A brief reason (helps us improve).</li>
      </ol>
      <p>Refunds are processed within 5 business days. The funds typically appear on your statement in 5–10 business days, depending on your bank.</p>

      <h2>Contact</h2>
      <p><strong>[SUPPORT EMAIL]</strong></p>
    </>
  );
}
