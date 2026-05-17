import { LegalDisclaimer } from "../_disclaimer";

export const metadata = { title: "Cookie Policy · Suds" };

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-xs text-gray-500">Last updated: [DATE]. Effective: [DATE].</p>
      <LegalDisclaimer />

      <p>
        This Cookie Policy explains how <strong>[LEGAL ENTITY NAME]</strong>{" "}
        (&quot;Suds&quot;, &quot;we&quot;) uses cookies and similar technologies.
      </p>

      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files saved to your device when you visit a website.
        They let the site remember actions and preferences (like staying logged in).
      </p>

      <h2>2. Cookies we use</h2>

      <h3>Strictly necessary (always on)</h3>
      <p>These are required for the Service to work. You cannot disable them.</p>
      <ul>
        <li><strong>Authentication session</strong> (Supabase Auth cookies) — keep you signed in for up to one year.</li>
        <li><strong>Portal session</strong> (<code>portal_session</code>) — for customer portal users; 30-day expiry; HTTP-only; SameSite=Strict.</li>
        <li><strong>OAuth state</strong> (<code>qbo_oauth_state</code>, similar) — short-lived; CSRF protection for OAuth flows.</li>
        <li><strong>Cookie consent record</strong> (<code>suds:cookie-consent</code>, localStorage) — stores your cookie preferences.</li>
      </ul>

      <h3>Optional (only if you accept)</h3>
      <p>
        Currently we do not load any optional cookies. If we add analytics in the
        future (e.g., to measure which features customers use), they will only load
        for visitors who clicked &quot;Accept all&quot; in our cookie banner.
      </p>

      <h2>3. Third-party cookies</h2>
      <p>None at this time.</p>
      <p>
        When you open Stripe&apos;s hosted Checkout, Stripe&apos;s own cookies are
        set on Stripe&apos;s domain — not ours. Stripe&apos;s cookie policy applies in that
        context.
      </p>

      <h2>4. How to control cookies</h2>
      <ul>
        <li><strong>Cookie banner</strong> — the first time you visit, you choose &quot;Accept all&quot; or &quot;Reject optional.&quot; Reject means we only set strictly-necessary cookies.</li>
        <li><strong>Change your choice</strong> — clear the <code>suds:cookie-consent</code> entry from your browser&apos;s local storage; the banner will reappear.</li>
        <li><strong>Browser controls</strong> — every modern browser lets you block or delete cookies. See your browser&apos;s help for details. Blocking strictly necessary cookies will sign you out and break the app.</li>
        <li><strong>Do Not Track</strong> — we honor the DNT browser signal where applicable.</li>
      </ul>

      <h2>5. Updates</h2>
      <p>If we change the cookies we use, we&apos;ll update this page and the &quot;Last updated&quot; date.</p>

      <h2>6. Questions</h2>
      <p>Email <strong>[PRIVACY EMAIL]</strong>.</p>
    </>
  );
}
