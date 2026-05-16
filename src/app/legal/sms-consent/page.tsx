import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "SMS Consent &amp; Messaging Policy · Suds" };

export default function SmsConsentPage() {
  return (
    <>
      <h1>SMS Messaging Policy &amp; Consent</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <p>
        This policy explains how SMS messaging works on Suds. It applies both to
        you (the business using Suds to send SMS to your customers) and to your
        customers (the recipients).
      </p>

      <h2>For your customers (recipients)</h2>

      <h3>Who is sending these messages?</h3>
      <p>
        SMS messages you receive are sent by a pressure washing business that uses
        Suds (a software platform). The business name appears in every message.
      </p>

      <h3>What messages will I get?</h3>
      <ul>
        <li>Appointment reminders (1 day before your service).</li>
        <li>Estimates ready for review.</li>
        <li>Invoices and payment receipts.</li>
        <li>Service follow-ups and review requests.</li>
        <li>Customer support replies you initiated.</li>
      </ul>
      <p>
        Message frequency varies based on your service schedule. Expect about 1–5
        messages per month during active service periods.
      </p>

      <h3>Cost</h3>
      <p>
        Standard message and data rates from your carrier may apply. Suds does not
        charge you to receive these messages.
      </p>

      <h3>How to stop messages (opt out)</h3>
      <p>
        Reply <strong>STOP</strong> to any message to immediately unsubscribe.
        You will receive one final confirmation, then no further messages.
        Reply <strong>HELP</strong> for help.
      </p>

      <h3>Re-subscribing</h3>
      <p>
        If you opt out by mistake, contact the business directly (their phone
        number is on the invoice or estimate they sent you) to be re-added.
      </p>

      <h2>For businesses using Suds to send SMS</h2>

      <h3>You are responsible for consent</h3>
      <p>
        Before sending any SMS via Suds, you must have express written consent
        from the recipient under the Telephone Consumer Protection Act (TCPA) and
        any applicable state laws. Consent must:
      </p>
      <ul>
        <li>Identify your business by name.</li>
        <li>Explain the types of messages they will receive.</li>
        <li>Note that consent is not required as a condition of purchase.</li>
        <li>Note standard message/data rates may apply.</li>
        <li>Include opt-out instructions (reply STOP).</li>
      </ul>

      <h3>Recommended consent language to add to your customer-facing forms</h3>
      <p className="not-prose border border-gray-200 rounded-md bg-gray-50 p-3 text-xs">
        By providing your phone number and checking this box, you agree to receive
        recurring automated SMS messages from [YOUR BUSINESS NAME] regarding
        appointments, estimates, invoices, and service updates. Consent is not a
        condition of purchase. Message frequency varies. Message and data rates
        may apply. Reply STOP to opt out, HELP for help. See our SMS Policy at
        [your-domain]/legal/sms-consent.
      </p>

      <h3>What Suds does automatically</h3>
      <ul>
        <li>Every message sent through Suds is logged in <code>sms_log</code> for compliance evidence.</li>
        <li>STOP/HELP replies are handled by Telnyx automatically.</li>
        <li>Once a recipient opts out, Suds will not send them further messages.</li>
      </ul>

      <h3>What Suds requires of you</h3>
      <ul>
        <li>Do not import phone numbers without express consent from each number&apos;s owner.</li>
        <li>Do not use Suds for marketing/promotional messages to non-consented recipients.</li>
        <li>Do not send messages outside <strong>8:00 AM – 9:00 PM</strong> local time of the recipient (TCPA).</li>
        <li>Honor opt-outs immediately.</li>
        <li>Keep records of consent for at least 4 years.</li>
      </ul>

      <h3>10DLC registration (required for US business SMS)</h3>
      <p>
        If you send SMS to US recipients, US carriers require your messaging to be
        registered under the 10DLC framework. This is handled through Telnyx:
      </p>
      <ol>
        <li>In Telnyx, register your business (Brand registration).</li>
        <li>Create a Messaging Campaign for the use case (Customer Care or Account Notifications).</li>
        <li>Once approved, assign your messaging profile to the registered campaign.</li>
        <li>Unregistered traffic is heavily throttled and may be blocked.</li>
      </ol>

      <h3>Prohibited content</h3>
      <ul>
        <li>SHAFT content (Sex, Hate, Alcohol, Firearms, Tobacco) without proper carrier registration.</li>
        <li>Misleading, deceptive, or fraudulent claims.</li>
        <li>Phishing, malware links, or social-engineering content.</li>
        <li>Content prohibited by Telnyx&apos;s terms.</li>
      </ul>

      <h3>Consequences of violations</h3>
      <p>
        Violations may result in (a) suspension of SMS sending from your account,
        (b) suspension of your Suds subscription, and (c) liability for any TCPA
        damages assessed against you. TCPA penalties range from $500 to $1,500 per
        message; class actions are common.
      </p>

      <h2>Carrier and regulatory information</h2>
      <ul>
        <li><strong>Aggregator:</strong> Telnyx LLC (CTIA member).</li>
        <li><strong>Carriers:</strong> all major US carriers (T-Mobile, AT&amp;T, Verizon).</li>
        <li><strong>Compliance frameworks:</strong> TCPA (US), CASL (Canada), CTIA short-code monitoring guidelines, 10DLC.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about SMS compliance: <strong>[SUPPORT EMAIL]</strong>.
      </p>
    </>
  );
}
