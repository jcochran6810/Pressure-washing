import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "Subprocessors · Suds" };

export default function SubprocessorsPage() {
  return (
    <>
      <h1>Subprocessors</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE].</p>
      <LegalDisclaimer />

      <p>
        Suds uses the following third-party services (&quot;Subprocessors&quot;) to
        deliver the platform. Each has a data processing agreement in place with
        us and meets industry security standards.
      </p>

      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-2 font-semibold">Subprocessor</th>
              <th className="text-left p-2 font-semibold">Purpose</th>
              <th className="text-left p-2 font-semibold">Location</th>
              <th className="text-left p-2 font-semibold">Data handled</th>
            </tr>
          </thead>
          <tbody className="[&_td]:p-2 [&_td]:border-b [&_td]:border-gray-100 [&_td]:align-top">
            <tr>
              <td><strong>Supabase, Inc.</strong></td>
              <td>Database, authentication, file storage</td>
              <td>US (AWS us-east-1)</td>
              <td>All Customer Content</td>
            </tr>
            <tr>
              <td><strong>Vercel, Inc.</strong></td>
              <td>Web hosting, edge compute</td>
              <td>US + global edge</td>
              <td>Request metadata, logs (no Customer Content persisted at rest)</td>
            </tr>
            <tr>
              <td><strong>Stripe, Inc.</strong></td>
              <td>Subscription billing + payment processing for end customers</td>
              <td>US</td>
              <td>Account email, business name, payment metadata. Card data never touches Suds.</td>
            </tr>
            <tr>
              <td><strong>Resend, Inc.</strong></td>
              <td>Transactional email delivery</td>
              <td>US</td>
              <td>Recipient email, subject, message body, delivery status</td>
            </tr>
            <tr>
              <td><strong>Telnyx LLC</strong></td>
              <td>SMS delivery</td>
              <td>US</td>
              <td>Recipient phone number, message body, delivery status</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> (optional)</td>
              <td>OAuth, Drive file storage, Maps</td>
              <td>US</td>
              <td>Only when you opt in. Drive: invoice/estimate/receipt files you choose to back up. Maps: property addresses you measure.</td>
            </tr>
            <tr>
              <td><strong>Intuit Inc.</strong> (optional)</td>
              <td>QuickBooks Online sync</td>
              <td>US</td>
              <td>Only when you opt in. Customers and invoices you choose to push.</td>
            </tr>
            <tr>
              <td><strong>Functional Software, Inc.</strong> (Sentry, optional)</td>
              <td>Error monitoring</td>
              <td>US/EU</td>
              <td>Anonymized stack traces and breadcrumbs. PII is filtered server-side.</td>
            </tr>
            <tr>
              <td><strong>UptimeRobot</strong> (optional)</td>
              <td>Public endpoint monitoring</td>
              <td>US</td>
              <td>Public URLs only. No Customer Content.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Adding or changing subprocessors</h2>
      <p>
        We will notify customers at least 30 days before adding a new subprocessor.
        To subscribe to notifications, email <strong>[PRIVACY EMAIL]</strong> with
        the subject &quot;Subprocessor notifications&quot;.
      </p>

      <h2>Customer-controlled subprocessors</h2>
      <p>
        Customers may opt in or out of Google Drive, QuickBooks, and Sentry from
        Settings → Integrations. Disabling an optional subprocessor removes our
        ability to provide that feature but does not affect core service.
      </p>
    </>
  );
}
