import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import {
  updateOrganization,
  disconnectGoogleDrive,
  saveMessagingCredentials,
  clearMessagingCredentials,
  setMessagingMode,
  setBusinessTypes,
  disconnectStripeConnect,
  pickTier,
  uploadLogo,
  removeLogo,
  setOrgSlug,
} from "./actions";
import { disconnectQbo } from "../accounting/actions";
import { getCalendarAccessToken, listCalendars, type GoogleCalendar } from "@/lib/google-calendar";
import { CalendarPicker } from "@/components/calendar-picker";
import { BusinessTypesPicker } from "@/components/business-types-picker";
import { qboConfigured } from "@/lib/qbo";
import { isEncryptionAvailable } from "@/lib/crypto";
import { TIERS, TIER_ORDER, TRIAL_DAYS, trialStateFor, PRO_ADDON_EMAIL_PER_PACK, PRO_ADDON_SMS_PER_PACK, INCLUDED_BUSINESS_TYPES, BUSINESS_TYPE_ADDON_MONTHLY_PRICE, businessTypeAddonCost, type Tier } from "@/lib/billing";
import { getOrgUsage, hasActiveSubscription } from "@/lib/billing-server";
import { getStripe } from "@/lib/stripe";
import { isConnectConfigured } from "@/lib/stripe-connect";
import { OAuthPopupConnect } from "@/components/oauth-popup-connect";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; msg?: string; qbo?: string; stripe?: string; saved?: string; billing?: string; error?: string }>;
}) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { google, msg, qbo, stripe, saved, billing, error } = await searchParams;
  const [
    { data: drive },
    { data: qboConn },
    { data: messagingCreds },
    { data: businessTypes },
    { data: orgBusinessTypes },
  ] = await Promise.all([
    supabase.from("google_drive_connections").select("*").eq("organization_id", organizationId).maybeSingle(),
    (supabase as any).from("qbo_connections").select("*").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("org_messaging_credentials").select("*").eq("organization_id", organizationId).maybeSingle(),
    (supabase as any).from("business_types").select("*").eq("active", true).order("sort_order"),
    (supabase as any).from("organization_business_types").select("business_type_id, is_primary, cancel_at_period_end, drops_at").eq("organization_id", organizationId),
  ]);
  // Active means still selected from the picker's POV. Cancelled-but-not-yet-dropped
  // trades stay in the dropdowns until billing_period_end but render unchecked
  // here so the operator can re-enable them at no charge.
  const selectedTypeIds = new Set<string>(
    (orgBusinessTypes ?? [])
      .filter((r: any) => !r.cancel_at_period_end)
      .map((r: any) => r.business_type_id),
  );
  const pendingDrops: Record<string, string | null> = {};
  for (const r of (orgBusinessTypes ?? []) as any[]) {
    if (r.cancel_at_period_end) pendingDrops[r.business_type_id] = r.drops_at ?? null;
  }
  const messagingMode: "platform" | "byoc" =
    (messagingCreds?.messaging_mode === "byoc" ? "byoc" : "platform");
  const subscriptionTier = (organization as any)?.subscription_tier ?? "basic";
  const trialEndsAt = (organization as any)?.trial_ends_at ?? null;
  const subscriptionStatus = (organization as any)?.subscription_status ?? null;
  const businessTypeId = (organization as any)?.business_type_id ?? "pressure_washing";
  const encryptionReady = isEncryptionAvailable();
  const stripeConnected = Boolean(getStripe());
  const stripeCustomerId = (organization as any)?.stripe_customer_id ?? null;
  const stripeConnectReady = isConnectConfigured();
  const stripeAccountId = (organization as any)?.stripe_account_id ?? null;
  const stripeConnectEmail = (organization as any)?.stripe_connect_email ?? null;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com";
  const usage = await getOrgUsage(organizationId);

  // If Google is connected with calendar scope, fetch the user's calendar list so
  // they can pick which one this app pulls events from.
  let calendars: GoogleCalendar[] = [];
  let calendarError: string | null = null;
  if (drive) {
    try {
      const conn = await getCalendarAccessToken(organizationId);
      if (conn) calendars = await listCalendars(conn.token);
    } catch (e) {
      calendarError = (e as Error).message;
    }
  }

  // Platform-level capabilities — set up once by the operator in Vercel env vars,
  // shared across every user. End users see these as availability indicators only.
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);
  const mapsConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const telnyxConfigured = Boolean(process.env.TELNYX_API_KEY);
  const qboEnvReady = qboConfigured();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-5">Settings</h1>

      {google === "connected" && <Notice tone="ok">Google Drive connected.</Notice>}
      {google === "error" && <Notice tone="error">Google Drive connect failed{msg ? `: ${msg}` : "."}</Notice>}
      {google === "no_refresh_token" && <Notice tone="error">Google didn't return a refresh token. Revoke access in your Google account and try again.</Notice>}
      {qbo === "connected" && <Notice tone="ok">QuickBooks Online connected.</Notice>}
      {qbo === "error" && <Notice tone="error">QuickBooks connect failed{msg ? `: ${msg}` : "."}</Notice>}
      {stripe === "connected" && <Notice tone="ok">Stripe payments connected. Payments deposit into your account.</Notice>}
      {stripe === "denied" && <Notice tone="error">Stripe connection was declined.</Notice>}
      {stripe === "error" && <Notice tone="error">Stripe connect failed{msg ? `: ${msg}` : "."}</Notice>}
      {stripe === "unauthorized" && <Notice tone="error">Only org owners or admins can connect Stripe.</Notice>}
      {billing === "updated" && <Notice tone="ok">Subscription updated. Welcome aboard.</Notice>}
      {billing === "canceled" && <Notice tone="error">Checkout was canceled. Your plan didn't change.</Notice>}
      {saved && <Notice tone="ok">{savedLabel(saved)}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <SubscriptionCard
        currentTier={subscriptionTier}
        usage={usage}
        stripeReady={stripeConnected}
        stripeCustomerId={stripeCustomerId}
        trialEndsAt={trialEndsAt}
        subscriptionStatus={subscriptionStatus}
        accessSource={(organization as any)?.access_source ?? null}
        compedUntil={(organization as any)?.comped_until ?? null}
      />

      <section className="card-padded mb-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold">Business types</h2>
          <span className="badge bg-gray-100 text-gray-700">
            {selectedTypeIds.size} selected
            {selectedTypeIds.size > INCLUDED_BUSINESS_TYPES
              ? ` · +$${businessTypeAddonCost(selectedTypeIds.size).toFixed(2)}/mo`
              : ""}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          The trades you operate in. Service templates, custom fields, and the booking page adapt to your
          selection. <strong>First {INCLUDED_BUSINESS_TYPES} trades are included free.</strong> Each
          additional trade is <strong>${BUSINESS_TYPE_ADDON_MONTHLY_PRICE.toFixed(2)}/mo</strong>.
        </p>
        <form action={setBusinessTypes}>
          <BusinessTypesPicker
            options={(businessTypes ?? []).map((b: any) => ({ id: b.id, name: b.name }))}
            initialSelected={Array.from(selectedTypeIds)}
            initialPrimary={
              (orgBusinessTypes ?? []).find((r: any) => r.is_primary)?.business_type_id ?? businessTypeId
            }
            pendingDrops={pendingDrops}
          />
        </form>
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Business info</h2>
        <form action={updateOrganization} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label>Business name</label><input name="name" defaultValue={organization?.name ?? ""} required className="w-full" /></div>
            <div><label>Phone</label><input name="phone" defaultValue={organization?.phone ?? ""} className="w-full" /></div>
            <div><label>Email</label><input name="email" type="email" defaultValue={organization?.email ?? ""} className="w-full" /></div>
            <div><label>Website</label><input name="website" defaultValue={organization?.website ?? ""} className="w-full" /></div>
          </div>
          <div><label>Address</label><input name="address_line1" defaultValue={organization?.address_line1 ?? ""} className="w-full" /></div>
          <div><label>Address line 2</label><input name="address_line2" defaultValue={organization?.address_line2 ?? ""} className="w-full" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label>City</label><input name="city" defaultValue={organization?.city ?? ""} className="w-full" /></div>
            <div><label>State</label><input name="state" defaultValue={organization?.state ?? ""} className="w-full" /></div>
            <div><label>Zip</label><input name="postal_code" defaultValue={organization?.postal_code ?? ""} className="w-full" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label>Tax rate</label><input name="tax_rate" type="number" step="0.0001" defaultValue={organization?.tax_rate ?? 0} className="w-full" /></div>
            <div><label>Currency</label><input name="currency" defaultValue={organization?.currency ?? "USD"} className="w-full" /></div>
            <div><label>Invoice prefix</label><input name="invoice_prefix" defaultValue={organization?.invoice_prefix ?? "INV"} className="w-full" /></div>
            <div><label>Estimate prefix</label><input name="estimate_prefix" defaultValue={organization?.estimate_prefix ?? "EST"} className="w-full" /></div>
          </div>

          <h3 className="font-semibold mt-2">Reminders & reviews</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label>Google review URL</label>
              <input name="google_review_url" type="url" defaultValue={organization?.google_review_url ?? ""} placeholder="https://g.page/r/…/review" className="w-full" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2">
                <input type="checkbox" name="review_request_enabled" defaultChecked={organization?.review_request_enabled !== false} />
                <span>Auto request reviews after payment</span>
              </label>
            </div>
            <div>
              <label>Appointment reminder lead (hours)</label>
              <input name="appointment_reminder_hours" type="number" min="0" defaultValue={organization?.appointment_reminder_hours ?? 24} className="w-full" />
            </div>
            <div>
              <label>Recurring service reminder (months)</label>
              <input name="recurring_reminder_months" type="number" min="0" defaultValue={organization?.recurring_reminder_months ?? 12} className="w-full" />
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Branding & public links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <h3 className="font-semibold text-sm mb-2">Logo</h3>
            <p className="text-xs text-gray-500 mb-2">Appears on estimate/invoice PDFs, the customer portal, and the booking page. PNG, JPEG, WebP, or SVG, under 2 MB.</p>
            {organization?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organization.logo_url} alt="Current logo" className="h-20 max-w-[200px] object-contain border border-gray-200 rounded p-2 bg-white mb-2" />
            ) : (
              <div className="h-20 max-w-[200px] border border-dashed border-gray-300 rounded grid place-items-center text-xs text-gray-400 mb-2">No logo yet</div>
            )}
            <form action={uploadLogo} encType="multipart/form-data" className="flex flex-wrap items-center gap-2">
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-xs" />
              <button className="btn-primary text-xs">Upload</button>
              {organization?.logo_url && (
                <form action={removeLogo}>
                  <button className="btn-ghost text-xs text-red-600">Remove</button>
                </form>
              )}
            </form>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2">Public booking link</h3>
            <p className="text-xs text-gray-500 mb-2">Share this URL so prospects can request a quote without signing in.</p>
            <form action={setOrgSlug} className="space-y-2">
              <div className="flex items-stretch border border-gray-300 rounded overflow-hidden">
                <span className="px-2 py-2 bg-gray-50 text-xs text-gray-500 self-center">{appOrigin}/book/</span>
                <input
                  name="slug"
                  defaultValue={(organization as any)?.slug ?? ""}
                  placeholder="your-business"
                  className="flex-1 border-0 text-sm focus:ring-0"
                  required
                />
              </div>
              <div className="flex justify-between items-center">
                {(organization as any)?.slug && (
                  <a href={`/book/${(organization as any).slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 underline">Open booking page →</a>
                )}
                <button className="btn-secondary text-xs ml-auto">Save slug</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-1">Connect your accounts</h2>
        <p className="text-xs text-gray-500 mb-3">
          Link your own Google and QuickBooks accounts so the app can read and write on your behalf.
        </p>
        <div className="space-y-3 text-sm">
          <ConnectAccountCard
            title="Google Drive & Calendar"
            description="Save invoices, estimates, receipts, and job photos to your Drive — and pull events from your Google Calendar into the in-app calendar."
            available={googleConfigured}
            connected={Boolean(drive)}
            connectedTo={drive?.connected_email ?? null}
            connectHref="/api/google/connect"
            manageUrl="https://drive.google.com"
            disconnectAction={disconnectGoogleDrive}
            popupProvider="google"
            setupHint={
              <div>
                <p className="font-medium text-gray-700">To enable, set these env vars on your deployment:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><code>GOOGLE_CLIENT_ID</code></li>
                  <li><code>GOOGLE_CLIENT_SECRET</code></li>
                  <li><code>NEXT_PUBLIC_APP_URL</code> (e.g. <code>https://yourdomain.com</code>)</li>
                </ul>
                <p className="mt-2">
                  Create the OAuth client at{" "}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">Google Cloud Console → APIs & Services → Credentials</a>.
                  Enable the <strong>Drive API</strong> and <strong>Calendar API</strong>, then authorize this redirect URI:
                </p>
                <p className="mt-1 font-mono text-[10px] bg-white border border-gray-200 rounded px-1.5 py-1 break-all">
                  {(process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com") + "/api/google/callback"}
                </p>
              </div>
            }
          />

          {drive && (
            <div id="calendar" className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">Linked Google Calendar</h3>
                  <p className="text-xs text-gray-600">
                    Pick which calendar's events show up on the in-app /calendar page.
                  </p>
                </div>
                {drive.calendar_name && (
                  <span className="badge bg-green-100 text-green-700">{drive.calendar_name}</span>
                )}
              </div>
              {calendarError ? (
                <p className="text-xs text-red-600 mt-2">
                  Couldn't load calendars: {calendarError}. Try reconnecting Google to grant the calendar.readonly scope.
                </p>
              ) : (
                <div className="mt-3">
                  <CalendarPicker calendars={calendars} currentCalendarId={drive.calendar_id ?? null} />
                </div>
              )}
            </div>
          )}

          <ConnectAccountCard
            title="QuickBooks Online"
            description="Push your invoices and customers live to QuickBooks for accounting sync."
            available={qboEnvReady}
            connected={Boolean(qboConn)}
            connectedTo={qboConn ? `realm ${qboConn.realm_id} · ${qboConn.environment}` : null}
            connectHref="/api/accounting/qbo/connect"
            manageUrl="https://quickbooks.intuit.com"
            disconnectAction={disconnectQbo}
            setupHint={
              <div>
                <p className="font-medium text-gray-700">To enable, set these env vars on your deployment:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><code>QBO_CLIENT_ID</code></li>
                  <li><code>QBO_CLIENT_SECRET</code></li>
                  <li><code>QBO_ENVIRONMENT</code> (<code>sandbox</code> or <code>production</code>)</li>
                </ul>
                <p className="mt-2">
                  Create the app at{" "}
                  <a href="https://developer.intuit.com/app/developer/dashboard" target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">Intuit Developer Dashboard</a>{" "}
                  and add this redirect URI:
                </p>
                <p className="mt-1 font-mono text-[10px] bg-white border border-gray-200 rounded px-1.5 py-1 break-all">
                  {(process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com") + "/api/accounting/qbo/callback"}
                </p>
              </div>
            }
          />

          <ConnectAccountCard
            title="Stripe payments"
            description="Customers pay invoices online; funds deposit into your own Stripe account, not the platform's."
            available={stripeConnectReady}
            connected={Boolean(stripeAccountId)}
            connectedTo={stripeConnectEmail ?? (stripeAccountId ? stripeAccountId.slice(0, 12) + "…" : null)}
            connectHref="/api/stripe/connect"
            manageUrl="https://dashboard.stripe.com"
            disconnectAction={disconnectStripeConnect}
            setupHint={
              <div>
                <p className="font-medium text-gray-700">To enable Stripe Connect (per-business payments), set:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><code>STRIPE_SECRET_KEY</code></li>
                  <li><code>STRIPE_CONNECT_CLIENT_ID</code></li>
                </ul>
                <p className="mt-2">
                  Get the Connect client ID at{" "}
                  <a href="https://dashboard.stripe.com/settings/connect" target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">Stripe Dashboard → Connect settings</a>.
                </p>
              </div>
            }
          />
        </div>
      </section>

      <section className="card-padded mb-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="font-semibold">Email & SMS</h2>
          <span className="badge bg-brand-100 text-brand-700 capitalize">{subscriptionTier} plan</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Pick where outbound email and SMS run from. The default uses the platform's shared providers
          included with your subscription. Switch to <strong>Bring your own keys</strong> if you'd rather
          run everything through your own Resend / Telnyx accounts.
        </p>

        <form action={setMessagingMode} className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            className={`border rounded-lg p-3 cursor-pointer ${
              messagingMode === "platform"
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 hover:border-brand-300"
            }`}
          >
            <input
              type="radio"
              name="messaging_mode"
              value="platform"
              defaultChecked={messagingMode === "platform"}
              className="sr-only"
            />
            <span className="font-semibold text-sm block">Use the platform (recommended)</span>
            <span className="block text-xs text-gray-600 mt-1">
              Included with your subscription. Nothing to configure — emails and SMS just work.
            </span>
          </label>
          <label
            className={`border rounded-lg p-3 cursor-pointer ${
              messagingMode === "byoc"
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 hover:border-brand-300"
            }`}
          >
            <input
              type="radio"
              name="messaging_mode"
              value="byoc"
              defaultChecked={messagingMode === "byoc"}
              className="sr-only"
            />
            <span className="font-semibold text-sm block">Bring your own keys</span>
            <span className="block text-xs text-gray-600 mt-1">
              Use your own Resend + Telnyx accounts. You pay the per-message cost; we never see your traffic.
            </span>
          </label>
          <button type="submit" className="btn-secondary text-xs sm:col-span-2 self-start">
            Save delivery mode
          </button>
        </form>

        {messagingMode === "byoc" && !encryptionReady && (
          <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
            ⚠️ <code>MESSAGING_SECRET</code> isn't configured on this deployment. Your keys will be stored
            in plaintext until the operator sets it. Ask support before saving production credentials.
          </div>
        )}

        {messagingMode === "byoc" && (
        <form action={saveMessagingCredentials} className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-sm">Email — Resend</h3>
                <p className="text-xs text-gray-600">
                  Sign up at{" "}
                  <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                    resend.com
                  </a>
                  , verify your sending domain, and create an API key. Free tier covers 3,000 emails/month.
                </p>
              </div>
              {messagingCreds?.resend_api_key ? (
                <span className="badge bg-green-100 text-green-700">Active</span>
              ) : (
                <span className="badge bg-gray-100 text-gray-700">Not set up</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-xs">
                Resend API key
                <input
                  type="password"
                  name="resend_api_key"
                  defaultValue={messagingCreds?.resend_api_key ? "••••••" : ""}
                  placeholder={messagingCreds?.resend_api_key ? "•••••• (saved — re-type to change)" : "re_..."}
                  className="w-full mt-0.5"
                />
              </label>
              <label className="text-xs">
                From address
                <input
                  type="text"
                  name="resend_from"
                  defaultValue={messagingCreds?.resend_from ?? ""}
                  placeholder={`${organization?.name ?? "Your Business"} <hello@yourdomain.com>`}
                  className="w-full mt-0.5"
                />
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-sm">SMS — Telnyx</h3>
                <p className="text-xs text-gray-600">
                  Sign up at{" "}
                  <a href="https://telnyx.com/sign-up" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                    telnyx.com
                  </a>
                  , buy a phone number, register for 10DLC, and create a v2 API key. Roughly $0.004/segment.
                </p>
              </div>
              {messagingCreds?.telnyx_api_key ? (
                <span className="badge bg-green-100 text-green-700">Active</span>
              ) : (
                <span className="badge bg-gray-100 text-gray-700">Not set up</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-xs">
                Telnyx API key
                <input
                  type="password"
                  name="telnyx_api_key"
                  defaultValue={messagingCreds?.telnyx_api_key ? "••••••" : ""}
                  placeholder={messagingCreds?.telnyx_api_key ? "•••••• (saved — re-type to change)" : "KEY..."}
                  className="w-full mt-0.5"
                />
              </label>
              <label className="text-xs">
                Sending phone number
                <input
                  type="tel"
                  name="telnyx_from_number"
                  defaultValue={messagingCreds?.telnyx_from_number ? "••••••" : ""}
                  placeholder={messagingCreds?.telnyx_from_number ? "•••••• (saved — re-type to change)" : "+15551234567"}
                  className="w-full mt-0.5"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary text-sm">Save messaging keys</button>
            {(messagingCreds?.resend_api_key || messagingCreds?.telnyx_api_key) && (
              <ClearMessagingButton action={clearMessagingCredentials} />
            )}
          </div>
        </form>
        )}
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-1">Platform services</h2>
        <p className="text-xs text-gray-500 mb-3">
          These run on the app's shared infrastructure — nothing for you to set up.
        </p>
        <div className="space-y-2 text-sm">
          <PlatformServiceRow
            title="Satellite imagery"
            description="Powers polygon measurements on satellite maps."
            active={mapsConfigured}
          />
          <PlatformServiceRow
            title="Online payments (Stripe Connect)"
            description="Pay Now links on invoices route funds straight to each business's connected Stripe account."
            active={stripeConfigured && stripeConnectReady}
            note={
              stripeConnectReady
                ? "Each business connects their own Stripe in the Connect your accounts panel above."
                : "Set STRIPE_CONNECT_CLIENT_ID to enable per-business payments."
            }
          />
          <PlatformServiceRow
            title="Email & SMS fallback"
            description="If you haven't entered your own messaging keys above, the platform routes through its shared providers."
            active={emailConfigured || telnyxConfigured}
            note={
              emailConfigured && telnyxConfigured
                ? "Both providers configured."
                : emailConfigured
                  ? "Only email fallback is configured."
                  : telnyxConfigured
                    ? "Only SMS fallback is configured."
                    : "No platform fallback configured — set up the messaging add-on above to send."
            }
          />
        </div>
      </section>
    </div>
  );
}

function ConnectAccountCard({
  title,
  description,
  available,
  connected,
  connectedTo,
  connectHref,
  manageUrl,
  disconnectAction,
  setupHint,
  popupProvider,
}: {
  title: string;
  description: string;
  available: boolean;
  connected: boolean;
  connectedTo?: string | null;
  connectHref: string;
  manageUrl?: string;
  disconnectAction?: () => Promise<void>;
  setupHint?: React.ReactNode;
  popupProvider?: "google" | "qbo" | "stripe";
}) {
  // Three states from the user's POV:
  // 1. Connected → tapping opens the service's management dashboard.
  // 2. Available, not connected → tapping starts the in-app OAuth flow.
  // 3. Not available on this deployment → show setup hint so the operator can wire it up.
  const state: "connected" | "ready" | "unavailable" = connected
    ? "connected"
    : available
      ? "ready"
      : "unavailable";

  const stateBadge =
    state === "connected" ? (
      <span className="badge bg-green-100 text-green-700 whitespace-nowrap">
        Connected{connectedTo ? ` · ${connectedTo}` : ""}
      </span>
    ) : state === "ready" ? (
      <span className="badge bg-yellow-100 text-yellow-700 whitespace-nowrap">Ready to connect</span>
    ) : (
      <span className="badge bg-gray-100 text-gray-700 whitespace-nowrap">Setup required</span>
    );

  const inner = (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {stateBadge}
        </div>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
        {state === "unavailable" && setupHint && (
          <div className="text-[11px] text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded p-2">
            {setupHint}
          </div>
        )}
        {state === "unavailable" && !setupHint && (
          <p className="text-[11px] text-gray-500 mt-1">Contact support if you need this enabled for your account.</p>
        )}
      </div>
      {state !== "unavailable" && (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 shrink-0">
          {state === "connected" ? "Manage" : "Connect"}
          {state === "connected" ? (
            <ExternalArrow />
          ) : (
            <Chevron />
          )}
        </span>
      )}
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-brand-300 hover:shadow-sm transition">
      {state === "connected" && manageUrl ? (
        <a
          href={manageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-3 hover:bg-brand-50/40 focus-visible:bg-brand-50/40 outline-none"
        >
          {inner}
        </a>
      ) : state === "ready" ? (
        popupProvider ? (
          <OAuthPopupConnect
            connectHref={connectHref}
            provider={popupProvider}
            className="block px-4 py-3 hover:bg-brand-50/40 focus-visible:bg-brand-50/40 outline-none cursor-pointer"
          >
            {inner}
          </OAuthPopupConnect>
        ) : (
          <Link
            href={connectHref}
            className="block px-4 py-3 hover:bg-brand-50/40 focus-visible:bg-brand-50/40 outline-none"
          >
            {inner}
          </Link>
        )
      ) : (
        <div className="block px-4 py-3 cursor-default">{inner}</div>
      )}
      {connected && disconnectAction && (
        <div className="px-4 py-2 border-t bg-gray-50 flex justify-end">
          <form action={disconnectAction}>
            <button type="submit" className="text-xs text-red-600 hover:underline">
              Disconnect
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PlatformServiceRow({
  title,
  description,
  active,
  note,
}: {
  title: string;
  description: string;
  active: boolean;
  note?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {active ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Currently unavailable
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
        {note && <p className="text-[11px] text-gray-500 mt-1">{note}</p>}
        {!active && (
          <p className="text-[11px] text-gray-500 mt-1">Contact support if you need this enabled.</p>
        )}
      </div>
    </div>
  );
}

function ExternalArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ClearMessagingButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Clear messaging keys
      </button>
    </form>
  );
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200";
  return <div className={`border rounded-md p-3 text-sm mb-4 ${cls}`}>{children}</div>;
}

// Maps the ?saved=<key> query param to a user-friendly confirmation message.
// Server actions in ./actions.ts redirect here after a successful save.
function savedLabel(key: string): string {
  switch (key) {
    case "org": return "Business info saved.";
    case "business_type": return "Business type updated.";
    case "messaging_creds": return "Messaging keys saved.";
    case "messaging_mode": return "Messaging mode updated.";
    case "messaging_cleared": return "Messaging keys cleared.";
    case "calendar": return "Linked calendar updated.";
    case "google_disconnected": return "Google Drive disconnected.";
    case "stripe_disconnected": return "Stripe payments disconnected.";
    case "tier_basic": return "Plan changed to Basic ($5/mo).";
    case "tier_plus": return "Plan changed to Plus ($15/mo).";
    case "tier_pro": return "Plan changed to Pro ($45/mo).";
    case "logo": return "Logo uploaded.";
    case "logo_removed": return "Logo removed.";
    case "slug": return "Public booking slug saved.";
    default: return "Changes saved.";
  }
}

function SubscriptionCard({
  currentTier,
  usage,
  stripeReady,
  stripeCustomerId,
  trialEndsAt,
  subscriptionStatus,
  accessSource,
  compedUntil,
}: {
  currentTier: Tier;
  usage: Awaited<ReturnType<typeof getOrgUsage>>;
  stripeReady: boolean;
  stripeCustomerId: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  accessSource: string | null;
  compedUntil: string | null;
}) {
  const cur = TIERS[currentTier] ?? TIERS.basic;
  const trial = trialStateFor(trialEndsAt);
  const subActive = hasActiveSubscription(subscriptionStatus);
  const isComped =
    accessSource === "admin_grant" || accessSource === "promo" || accessSource === "internal";
  const compedActive = isComped && (!compedUntil || new Date(compedUntil) > new Date());
  const trialExpired = !compedActive && !trial.active && !subActive;

  // Comped accounts get a totally different card body — no tier picker, no
  // payment messaging, just a friendly "you have free access" note.
  if (compedActive) {
    return (
      <section className="card-padded mb-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="font-semibold">Subscription</h2>
          <span className="badge bg-emerald-100 text-emerald-700">{cur.label} · Free access</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">{cur.description}</p>

        <div className="mb-4 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md p-4">
          <strong>You have free access to {cur.label}.</strong>{" "}
          {compedUntil
            ? `Granted by the platform team — valid until ${new Date(compedUntil).toLocaleDateString()}.`
            : "Granted by the platform team — no payment required."}
          <p className="text-xs text-emerald-800/80 mt-1">Need a change? Get in touch with support.</p>
        </div>

        {!usage.byoc && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <UsageBar label="Email this month" used={usage.emailUsed} limit={usage.emailLimit} />
            <UsageBar label="SMS this month" used={usage.smsUsed} limit={usage.smsLimit} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card-padded mb-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="font-semibold">Subscription</h2>
        <span className="badge bg-brand-100 text-brand-700">{cur.label} · ${cur.monthlyPrice}/mo</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{cur.description}</p>

      {trial.active && !subActive && (
        <div className="mb-4 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-3">
          <strong>Free trial active.</strong> You have {trial.daysRemaining}{" "}
          {trial.daysRemaining === 1 ? "day" : "days"} left on your {TRIAL_DAYS}-day trial. Pick a plan below
          before {trial.endsAt?.toLocaleDateString() ?? "your trial ends"} to keep your account active —
          you won't be charged until then.
        </div>
      )}
      {trialExpired && (
        <div className="mb-4 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md p-3">
          <strong>Trial ended.</strong> Choose a plan below to re-activate messaging and the rest of your
          account.
        </div>
      )}

      {!usage.byoc && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <UsageBar label="Email this month" used={usage.emailUsed} limit={usage.emailLimit} />
          <UsageBar label="SMS this month" used={usage.smsUsed} limit={usage.smsLimit} />
        </div>
      )}
      {!usage.byoc && usage.quotaAddons > 0 && (
        <div className="mb-4 text-xs text-brand-800 bg-brand-50 border border-brand-200 rounded-md p-2">
          <strong>{usage.quotaAddons}</strong> Pro quota pack{usage.quotaAddons === 1 ? "" : "s"} active —{" "}
          adds +{(usage.quotaAddons * PRO_ADDON_EMAIL_PER_PACK).toLocaleString()} emails and{" "}
          +{(usage.quotaAddons * PRO_ADDON_SMS_PER_PACK).toLocaleString()} SMS to this month's quota.
        </div>
      )}
      {currentTier === "pro" && subActive && !usage.byoc && (
        <div className="mb-4 flex items-center justify-between gap-2 text-xs bg-gray-50 border border-gray-200 rounded-md p-3">
          <div>
            <strong className="text-gray-800">Need more capacity?</strong>
            <p className="text-gray-600 mt-0.5">
              Pro add-on packs are +{PRO_ADDON_EMAIL_PER_PACK.toLocaleString()} emails and{" "}
              +{PRO_ADDON_SMS_PER_PACK.toLocaleString()} SMS each, stackable. Manage packs in the
              billing portal.
            </p>
          </div>
          {stripeCustomerId && (
            <a href="/api/billing/portal" className="btn-secondary text-xs whitespace-nowrap">
              Manage add-ons
            </a>
          )}
        </div>
      )}
      {usage.byoc && (
        <div className="mb-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2">
          You're routing email and SMS through your own provider keys, so platform quotas don't apply.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIER_ORDER.map((id) => {
          const t = TIERS[id];
          const isCurrent = id === currentTier && subActive;
          const ctaLabel = subActive
            ? isCurrent
              ? "Current plan"
              : t.monthlyPrice > cur.monthlyPrice
                ? `Upgrade to ${t.label}`
                : `Switch to ${t.label}`
            : `Start ${TRIAL_DAYS}-day free trial`;
          return (
            <div
              key={id}
              className={`border rounded-lg p-3 flex flex-col ${
                isCurrent ? "border-brand-300 bg-brand-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{t.label}</h3>
                <span className="text-xs text-gray-500">${t.monthlyPrice}/mo</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{t.description}</p>
              <ul className="text-[11px] text-gray-700 space-y-1 mb-3 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <span aria-hidden className="text-brand-600">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <p className="text-[11px] text-brand-700 font-medium">Current plan</p>
              ) : (
                <form action={pickTier}>
                  <input type="hidden" name="tier" value={id} />
                  <button type="submit" className="btn-primary text-xs w-full">
                    {ctaLabel}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {stripeCustomerId && (
        <div className="mt-3 flex justify-end">
          <a href="/api/billing/portal" className="btn-secondary text-xs">Manage billing →</a>
        </div>
      )}
      {!stripeReady && (
        <p className="text-[11px] text-gray-500 mt-3">
          Operator: set <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_BILLING_WEBHOOK_SECRET</code>, and price-id env
          vars (<code>STRIPE_PRICE_ID_BASIC</code>, <code>STRIPE_PRICE_ID_PLUS</code>, <code>STRIPE_PRICE_ID_PRO</code>,{" "}
          <code>STRIPE_PRICE_ID_PRO_ADDON</code>, <code>STRIPE_PRICE_ID_BUSINESS_TYPE_ADDON</code>) to enable in-app upgrades.
        </p>
      )}
    </section>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-500">
          {used.toLocaleString()}{limit > 0 ? ` / ${limit.toLocaleString()}` : " (none included)"}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${limit > 0 ? pct : 0}%` }} />
      </div>
    </div>
  );
}
