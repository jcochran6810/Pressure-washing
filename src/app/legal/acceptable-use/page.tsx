import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "Acceptable Use Policy · Suds" };

export default function AcceptableUsePage() {
  return (
    <>
      <h1>Acceptable Use Policy (AUP)</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <p>
        This Acceptable Use Policy lists what you may not do with the Suds
        Service. Violations may result in suspension or termination of your
        account, and may expose you to legal liability. This AUP is incorporated
        into the Terms of Service.
      </p>

      <h2>Prohibited activities</h2>

      <h3>Unlawful or harmful conduct</h3>
      <ul>
        <li>Use the Service in violation of any law, regulation, or industry standard.</li>
        <li>Violate the privacy or rights of any person, including unauthorized collection of personal information.</li>
        <li>Engage in fraud, money laundering, or tax evasion.</li>
        <li>Process payments for prohibited industries (firearms, controlled substances, adult content, gambling, MLM, etc.).</li>
      </ul>

      <h3>Unsolicited communications</h3>
      <ul>
        <li>Send SMS or email to recipients who have not given express consent (see <a href="/legal/sms-consent">SMS Consent Policy</a>).</li>
        <li>Purchase, scrape, or rent contact lists.</li>
        <li>Send spam, phishing, or deceptive messages.</li>
        <li>Send messages outside permitted hours under TCPA (8:00 AM – 9:00 PM local time of recipient).</li>
        <li>Use the Service to facilitate political robocalls or political SMS without proper compliance with state robocall laws.</li>
      </ul>

      <h3>System abuse</h3>
      <ul>
        <li>Reverse engineer, decompile, or attempt to extract the source code.</li>
        <li>Bypass rate limits, authentication, or security controls.</li>
        <li>Penetration testing without prior written authorization.</li>
        <li>Submit malicious code, viruses, or content designed to disrupt the Service.</li>
        <li>Use bots, scrapers, or other automated means to extract data beyond your own account.</li>
        <li>Resell, white-label, or sublicense the Service without a written reseller agreement.</li>
      </ul>

      <h3>Content abuse</h3>
      <ul>
        <li>Upload content that is defamatory, harassing, hateful, or threatening.</li>
        <li>Upload images depicting minors in any compromising context.</li>
        <li>Upload content that infringes intellectual property of others.</li>
        <li>Use the Service to generate or distribute deepfakes, misinformation, or impersonation content.</li>
      </ul>

      <h3>Misuse of integrations</h3>
      <ul>
        <li>Use the Stripe integration to process payments unrelated to your pressure washing business or to evade Stripe&apos;s prohibited business categories.</li>
        <li>Use the Google Drive integration to store or distribute prohibited content.</li>
        <li>Use SMS templates designed to mimic legitimate institutions for phishing.</li>
      </ul>

      <h3>Account abuse</h3>
      <ul>
        <li>Create multiple accounts to circumvent free-trial limits, opt-outs, or bans.</li>
        <li>Provide false information during signup or in billing.</li>
        <li>Share account credentials publicly or with unauthorized third parties.</li>
        <li>Use the customer portal to send unsolicited communications to customers who have not opted in.</li>
      </ul>

      <h2>Enforcement</h2>
      <p>If we believe you have violated this AUP, we may, at our discretion:</p>
      <ol>
        <li>Issue a warning.</li>
        <li>Suspend specific features (e.g., SMS sending) pending investigation.</li>
        <li>Suspend your entire account, preserving your data for export.</li>
        <li>Terminate your account immediately for severe or repeated violations.</li>
        <li>Cooperate with law enforcement when legally required.</li>
      </ol>
      <p>
        For violations that pose immediate harm (e.g., active fraud, ongoing TCPA
        violations), suspension may be immediate and without notice.
      </p>

      <h2>Reporting violations</h2>
      <p>To report abuse, email <strong>[ABUSE EMAIL]</strong> with:</p>
      <ul>
        <li>The account or content in question.</li>
        <li>Description of the issue.</li>
        <li>Any supporting evidence (screenshots, message copies).</li>
      </ul>

      <h2>Appeals</h2>
      <p>
        If you believe your account was suspended in error, email{" "}
        <strong>[SUPPORT EMAIL]</strong> within 30 days. We will review and
        respond within 5 business days.
      </p>
    </>
  );
}
