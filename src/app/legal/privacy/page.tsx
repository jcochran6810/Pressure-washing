import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "Privacy Policy · Suds" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <p>
        This Privacy Policy explains how <strong>[LEGAL ENTITY NAME]</strong>{" "}
        (&quot;Suds&quot;, &quot;we&quot;) collects, uses, and discloses information.
      </p>

      <h2>1. Information we collect</h2>
      <h3>From you (Account holders)</h3>
      <ul>
        <li><strong>Account info:</strong> name, business name, email, phone, password (hashed).</li>
        <li><strong>Business info:</strong> address, tax rate, currency, logo, integration tokens.</li>
        <li><strong>Billing info:</strong> processed by Stripe; we store only the Stripe customer ID and last-four/brand metadata. We never see full card numbers.</li>
        <li><strong>Two-factor authentication:</strong> if enabled, TOTP secrets stored by Supabase Auth.</li>
      </ul>

      <h3>About your customers (Customer Content)</h3>
      <ul>
        <li>Names, addresses, phone numbers, email addresses, service history, photos, signatures, and payment records you enter.</li>
        <li>This information is owned by you. We process it solely to provide the Service to you (we are a data processor; you are the controller).</li>
      </ul>

      <h3>Automatically</h3>
      <ul>
        <li><strong>Usage data:</strong> pages visited, actions taken, IP address, browser/device info, timestamps.</li>
        <li><strong>Cookies &amp; similar:</strong> session cookies for authentication; first-party only. No third-party advertising cookies.</li>
        <li><strong>Error reports:</strong> if Sentry is enabled, anonymized stack traces and breadcrumbs may be collected to diagnose problems.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To process subscription payments and send transactional emails (receipts, reminders, security alerts).</li>
        <li>To respond to support requests.</li>
        <li>To detect and prevent fraud, abuse, and security incidents.</li>
        <li>To comply with legal obligations.</li>
        <li>With your explicit consent, to send product updates and marketing.</li>
      </ul>

      <h2>3. How we share information</h2>
      <p>We do not sell your personal information. We share data only with:</p>
      <ul>
        <li><strong>Service providers (subprocessors):</strong> Supabase (database, auth, storage), Vercel (hosting), Stripe (payments), Resend (email), Telnyx (SMS), Sentry (error monitoring). Each operates under a data-processing agreement with us.</li>
        <li><strong>Legal compliance:</strong> if required by law, subpoena, or to protect our rights.</li>
        <li><strong>Business transfers:</strong> if Suds is acquired or merges, your data may transfer to the successor entity under the same protections.</li>
      </ul>
      <p>Full subprocessor list: <a href="/legal/subprocessors">/legal/subprocessors</a>.</p>

      <h2>4. Data retention</h2>
      <ul>
        <li>Account data: retained while your subscription is active and for 90 days after cancellation, then permanently deleted unless legally required to retain.</li>
        <li>Audit logs: 2 years.</li>
        <li>Auto-save drafts: 30 days.</li>
        <li>Customer portal sessions: 7 days past expiration.</li>
        <li>Stripe billing records: retained per Stripe&apos;s policy (7 years for tax compliance).</li>
      </ul>

      <h2>5. Your rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Request correction of inaccurate information.</li>
        <li>Request deletion of your personal information.</li>
        <li>Export your data in a portable format.</li>
        <li>Opt out of marketing emails.</li>
        <li>Object to or restrict certain processing.</li>
      </ul>
      <p>To exercise these rights, email <strong>[PRIVACY EMAIL]</strong>. We will respond within 30 days.</p>

      <h3>California (CCPA / CPRA)</h3>
      <p>California residents have the rights listed above plus the right to know what personal information we have collected and to non-discrimination for exercising privacy rights. We do not sell personal information.</p>

      <h3>EU/UK (GDPR)</h3>
      <p>Our lawful basis for processing: (a) performance of a contract with you, (b) legitimate interests in operating and improving the Service, (c) consent for marketing communications, and (d) legal obligations. We may transfer data to the United States; transfers are protected by Standard Contractual Clauses where required.</p>

      <h2>6. Security</h2>
      <ul>
        <li>All data in transit is encrypted via TLS.</li>
        <li>Data at rest is encrypted by Supabase using AES-256.</li>
        <li>Access to production systems is restricted, logged, and uses multi-factor authentication.</li>
        <li>We follow industry-standard practices including regular dependency updates, security review of code changes, and incident response procedures.</li>
        <li>No system is perfectly secure. In the event of a breach affecting your data, we will notify you within 72 hours of discovery.</li>
      </ul>

      <h2>7. Children</h2>
      <p>The Service is not directed at children under 16. We do not knowingly collect data from children.</p>

      <h2>8. Cookies</h2>
      <p>
        We use only essential first-party cookies for authentication and session
        management. We do not use third-party advertising or tracking cookies.
        Cookie banner is not required because we use no consent-required cookies.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy. Material changes will be announced via email or
        in-app notice 30 days before the effective date. The &quot;Last updated&quot;
        date at the top reflects the most recent revision.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions: <strong>[PRIVACY EMAIL]</strong>. EU/UK representative
        (if applicable): <strong>[REPRESENTATIVE NAME / ADDRESS]</strong>.
      </p>
    </>
  );
}
