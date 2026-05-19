import { LegalDisclaimer } from "../_disclaimer";
import Link from "next/link";

export const metadata = { title: "Data Processing Addendum · Suds" };

export default function DpaPage() {
  return (
    <>
      <h1>Data Processing Addendum</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <p>
        This Data Processing Addendum (&quot;DPA&quot;) supplements the{" "}
        <Link href="/legal/terms">Terms of Service</Link> between you
        (&quot;Customer&quot;, &quot;Controller&quot;) and{" "}
        <strong>[LEGAL ENTITY NAME]</strong> (&quot;Suds&quot;, &quot;Processor&quot;).
        It applies whenever Suds processes personal information about your end users
        (your customers) on your behalf.
      </p>

      <h2>1. Definitions</h2>
      <p>
        Terms not defined here have the meaning given in the GDPR, UK GDPR, or CCPA,
        as applicable. &quot;Personal Data&quot; means any information relating to an
        identified or identifiable natural person.
      </p>

      <h2>2. Roles</h2>
      <ul>
        <li>Customer is the Controller of Personal Data about its end customers.</li>
        <li>Suds is the Processor and acts only on documented instructions from the Customer.</li>
        <li>Customer instructions are reflected in the configuration and use of the Service.</li>
      </ul>

      <h2>3. Subject matter and duration</h2>
      <ul>
        <li><strong>Subject:</strong> processing of Personal Data to provide the Service.</li>
        <li><strong>Duration:</strong> the term of the Customer&apos;s subscription, plus the 90-day post-termination retention window.</li>
        <li><strong>Nature:</strong> storage, hosting, transmission, organization, retrieval, and deletion.</li>
        <li><strong>Purpose:</strong> to enable Customer to manage its pressure washing business operations.</li>
        <li><strong>Data subjects:</strong> Customer&apos;s end customers, employees, contractors, and other contacts.</li>
        <li><strong>Categories of data:</strong> names, addresses, phone numbers, email addresses, payment metadata, photos, service histories, signed waivers.</li>
      </ul>

      <h2>4. Processor obligations</h2>
      <p>Suds will:</p>
      <ul>
        <li>Process Personal Data only on documented instructions from Customer.</li>
        <li>Ensure persons authorized to process Personal Data are bound by confidentiality.</li>
        <li>Implement appropriate technical and organizational security measures (see Annex II).</li>
        <li>Assist Customer in responding to data subject requests.</li>
        <li>Notify Customer without undue delay (within 72 hours) of any Personal Data breach.</li>
        <li>At Customer&apos;s choice, delete or return Personal Data at the end of the service, except where law requires storage.</li>
        <li>Make available all information necessary to demonstrate compliance and allow for audits (subject to reasonable notice).</li>
      </ul>

      <h2>5. Subprocessors</h2>
      <p>
        Customer authorizes Suds to engage the subprocessors listed at{" "}
        <Link href="/legal/subprocessors">/legal/subprocessors</Link>. Suds will
        notify Customer of any new subprocessor at least 30 days before they begin
        processing, and Customer may object on reasonable grounds.
      </p>
      <p>
        Suds remains liable for the acts and omissions of its subprocessors with
        respect to Personal Data.
      </p>

      <h2>6. International transfers</h2>
      <p>
        Personal Data may be processed in the United States and other countries
        where Suds and its subprocessors operate. Where Personal Data of EU/UK data
        subjects is transferred outside the EEA/UK, the transfer relies on the EU
        Standard Contractual Clauses (Modules 2 and 3) and the UK Addendum, which
        are incorporated by reference.
      </p>

      <h2>7. Data subject rights</h2>
      <p>
        Suds will provide reasonable assistance to Customer in fulfilling data
        subject requests (access, correction, deletion, portability, restriction,
        objection). Most requests can be fulfilled by Customer directly using the
        admin interface. For requests requiring our assistance, contact{" "}
        <strong>[PRIVACY EMAIL]</strong>.
      </p>

      <h2>8. Breach notification</h2>
      <p>
        In the event of a Personal Data breach, Suds will notify Customer without
        undue delay (and in any event within 72 hours of becoming aware), providing:
      </p>
      <ul>
        <li>Description of the nature of the breach.</li>
        <li>Categories and approximate number of data subjects affected.</li>
        <li>Likely consequences.</li>
        <li>Measures taken or proposed to address the breach and mitigate adverse effects.</li>
      </ul>

      <h2>9. Deletion and return</h2>
      <p>
        Upon termination of the Service, Customer may export its data for 90 days.
        After that period, Suds will permanently delete Personal Data within 30 days
        (excluding backups, which are deleted within 90 days), except as required
        by law.
      </p>

      <h2>10. Audits</h2>
      <p>
        Customer may request, no more than once per year, written information
        sufficient to demonstrate Suds&apos; compliance with this DPA. On-site
        audits may be conducted upon reasonable notice, during business hours, at
        Customer&apos;s expense.
      </p>

      <h2>11. Liability and indemnification</h2>
      <p>Liability is governed by the Terms of Service.</p>

      <h2>12. Order of precedence</h2>
      <p>
        In case of conflict between this DPA and the Terms of Service, this DPA
        controls with respect to Personal Data.
      </p>

      <hr className="my-6" />

      <h2>Annex I — Description of processing</h2>
      <p>See sections 3 above and the {" "}
        <Link href="/legal/subprocessors">subprocessor list</Link>.</p>

      <h2>Annex II — Technical and organizational measures</h2>
      <ul>
        <li>TLS 1.2+ for all data in transit.</li>
        <li>AES-256 encryption at rest (via Supabase).</li>
        <li>Row-level security policies on all customer-tenanted tables.</li>
        <li>Multi-factor authentication available for all accounts (TOTP).</li>
        <li>Service-role keys stored in environment-variable secrets, never in code.</li>
        <li>Audit log of all material data changes, retained for 2 years.</li>
        <li>Automated backups (Supabase daily PITR snapshots).</li>
        <li>Stripe is PCI-DSS Level 1 certified; card data never reaches our systems.</li>
        <li>Production access restricted to authorized personnel; access logged.</li>
        <li>Annual security review of dependencies and infrastructure.</li>
      </ul>
    </>
  );
}
