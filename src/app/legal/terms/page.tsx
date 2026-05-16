import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "Terms of Service · Suds" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <h2>1. Agreement</h2>
      <p>
        These Terms of Service (&quot;Terms&quot;) are a legal agreement between you
        (the business or individual creating an account) and <strong>[LEGAL ENTITY
        NAME]</strong>, a <strong>[STATE]</strong> <strong>[LLC/Corp]</strong>
        (&quot;Suds&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or
        using the Suds platform (the &quot;Service&quot;), you agree to these Terms.
        If you do not agree, do not use the Service.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and authorized to bind the business you
        register on behalf of. The Service is intended for use by pressure washing
        and exterior cleaning businesses operating in the United States.
      </p>

      <h2>3. Account &amp; security</h2>
      <ul>
        <li>You are responsible for keeping your account credentials confidential and for all activity under your account.</li>
        <li>Notify us immediately of any unauthorized access at <strong>[SUPPORT EMAIL]</strong>.</li>
        <li>We recommend enabling two-factor authentication in Settings → Security.</li>
        <li>You will not share a single account among multiple users; instead, invite team members from your organization settings.</li>
      </ul>

      <h2>4. Subscription, billing &amp; refunds</h2>
      <ul>
        <li>Suds is a subscription service billed monthly in advance via Stripe.</li>
        <li>Subscriptions begin at the end of any free trial. Trial users are not charged unless they convert.</li>
        <li>You authorize Stripe to charge your designated payment method on a recurring basis until you cancel.</li>
        <li>If a payment fails, your account moves to <em>past due</em> mode (read-only access). After Stripe&apos;s retry window (~21 days), the subscription is cancelled.</li>
        <li>Refund eligibility is governed by our <a href="/legal/refund">Refund Policy</a>.</li>
        <li>You may cancel at any time from <a href="/billing">Billing</a>; cancellations take effect at the end of the current billing period.</li>
        <li>We may change pricing on 30 days&apos; advance notice. Continued use after the effective date constitutes acceptance.</li>
      </ul>

      <h2>5. Your data &amp; ownership</h2>
      <ul>
        <li>You retain all rights to data you upload — customer records, photos, invoices, etc. (&quot;Customer Content&quot;).</li>
        <li>You grant us a limited license to host, process, and display Customer Content solely to provide the Service.</li>
        <li>You are responsible for the accuracy, legality, and quality of Customer Content.</li>
        <li>You represent that you have the necessary rights and consents to upload and process Customer Content (including from your own customers).</li>
      </ul>

      <h2>6. Acceptable use</h2>
      <p>
        Your use of the Service is governed by our <a href="/legal/acceptable-use">Acceptable Use Policy</a>.
        Violations may result in suspension or termination.
      </p>

      <h2>7. Third-party services</h2>
      <p>
        Suds integrates with third-party services including Stripe, Resend, Telnyx,
        Google, and QuickBooks. Your use of those services is governed by their own
        terms. We are not liable for outages or failures of third-party services.
      </p>

      <h2>8. SMS &amp; email messaging</h2>
      <p>
        Communications you send through the Service (SMS, email) are sent under
        your business identity. You are responsible for obtaining consent from each
        recipient before sending. See our <a href="/legal/sms-consent">SMS Consent Policy</a> for
        specific requirements.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        All software, designs, trademarks, and content provided by Suds are owned
        by us. You receive a non-exclusive, non-transferable license to use the
        Service while your subscription is active. You may not copy, reverse
        engineer, or resell the Service.
      </p>

      <h2>10. Confidentiality</h2>
      <p>
        Each party will protect the other&apos;s confidential information with at
        least the same degree of care it uses to protect its own (no less than
        reasonable care).
      </p>

      <h2>11. Warranty disclaimer</h2>
      <p className="uppercase text-xs">
        The Service is provided &quot;as is&quot; and &quot;as available&quot; without
        warranties of any kind, express or implied, including merchantability,
        fitness for a particular purpose, or non-infringement. We do not warrant that
        the Service will be uninterrupted, error-free, or secure.
      </p>

      <h2>12. Limitation of liability</h2>
      <p className="uppercase text-xs">
        To the maximum extent permitted by law, Suds&apos; total liability arising
        out of or related to these Terms or the Service will not exceed the amount
        you paid us in the 12 months preceding the claim. In no event will we be
        liable for indirect, incidental, special, consequential, or punitive damages,
        or for lost profits, revenue, or data.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You will defend, indemnify, and hold Suds harmless from any claim arising
        out of (a) your use of the Service in violation of these Terms, (b) your
        Customer Content, or (c) your interactions with your own customers.
      </p>

      <h2>14. Termination</h2>
      <ul>
        <li>You may terminate at any time by cancelling your subscription.</li>
        <li>We may suspend or terminate your account for material breach of these Terms, fraud, non-payment, or extended inactivity.</li>
        <li>After termination, your data will be retained for 90 days, then permanently deleted unless legally required to retain longer. You may export your data during this window.</li>
      </ul>

      <h2>15. Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of <strong>[STATE]</strong>, without
        regard to conflict-of-laws principles. Disputes will be resolved by binding
        arbitration in <strong>[CITY, STATE]</strong> under the Commercial Arbitration
        Rules of the American Arbitration Association, except either party may seek
        injunctive relief in court for IP claims. CLASS ACTIONS ARE WAIVED.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you by email
        and/or an in-app banner at least 30 days before material changes take effect.
        Continued use after the effective date constitutes acceptance.
      </p>

      <h2>17. Contact</h2>
      <p>
        Questions about these Terms? Email <strong>[LEGAL EMAIL]</strong> or write to
        <strong> [LEGAL ENTITY], [ADDRESS]</strong>.
      </p>
    </>
  );
}
