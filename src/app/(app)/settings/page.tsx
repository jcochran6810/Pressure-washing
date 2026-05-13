import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { updateOrganization, disconnectGoogleDrive } from "./actions";
import { disconnectQbo } from "../accounting/actions";
import { getCalendarAccessToken, listCalendars, type GoogleCalendar } from "@/lib/google-calendar";
import { CalendarPicker } from "@/components/calendar-picker";
import { qboConfigured } from "@/lib/qbo";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string; msg?: string; qbo?: string }> }) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { google, msg, qbo } = await searchParams;
  const [{ data: drive }, { data: qboConn }] = await Promise.all([
    supabase.from("google_drive_connections").select("*").eq("organization_id", organizationId).maybeSingle(),
    (supabase as any).from("qbo_connections").select("*").eq("organization_id", organizationId).maybeSingle(),
  ]);

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
        <h2 className="font-semibold mb-1">Integrations</h2>
        <p className="text-xs text-gray-500 mb-3">Tap a card to set up, connect, or manage the service.</p>
        <div className="space-y-3 text-sm">
          <IntegrationCard
            title="Google Drive & Calendar"
            description="Save invoices, estimates, receipts, and job photos to Drive — and pull events from a Google Calendar into the in-app calendar."
            envReady={googleConfigured}
            connected={Boolean(drive)}
            connectedTo={drive?.connected_email ?? null}
            signupUrl="https://console.cloud.google.com/apis/credentials"
            signupLabel="Get OAuth credentials"
            connectHref="/api/google/connect"
            manageUrl="https://drive.google.com"
            disconnectAction={disconnectGoogleDrive}
            envHint="Then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Vercel project."
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

          <IntegrationCard
            title="QuickBooks Online"
            description="Push invoices and customers live to QuickBooks for accounting sync."
            envReady={qboEnvReady}
            connected={Boolean(qboConn)}
            connectedTo={qboConn ? `realm ${qboConn.realm_id} · ${qboConn.environment}` : null}
            signupUrl="https://developer.intuit.com/app/developer/dashboard"
            signupLabel="Create an Intuit app"
            connectHref="/api/accounting/qbo/connect"
            manageUrl="https://quickbooks.intuit.com"
            disconnectAction={disconnectQbo}
            envHint="Then set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, and QBO_ENVIRONMENT."
          />

          <IntegrationCard
            title="Stripe"
            description="Create payment links on invoices and auto-record payments when customers pay online."
            envReady={stripeConfigured}
            connected={stripeConfigured}
            signupUrl="https://dashboard.stripe.com/register"
            signupLabel="Create a Stripe account"
            manageUrl="https://dashboard.stripe.com"
            envHint="Then set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET for webhooks)."
          />

          <IntegrationCard
            title="Resend (email)"
            description="Automatically email estimates, invoices, and paid receipts to customers."
            envReady={emailConfigured}
            connected={emailConfigured}
            signupUrl="https://resend.com/signup"
            signupLabel="Create a Resend account"
            manageUrl="https://resend.com/api-keys"
            envHint="Then set RESEND_API_KEY and RESEND_FROM."
          />

          <IntegrationCard
            title="Telnyx (SMS)"
            description="Send appointment reminders, estimate links, and receipts via text message."
            envReady={telnyxConfigured}
            connected={telnyxConfigured}
            signupUrl="https://telnyx.com/sign-up"
            signupLabel="Create a Telnyx account"
            manageUrl="https://portal.telnyx.com"
            envHint="Then set TELNYX_API_KEY and TELNYX_FROM_NUMBER."
          />

          <IntegrationCard
            title="Google Maps"
            description="Powers the polygon measurement tool on satellite imagery."
            envReady={mapsConfigured}
            connected={mapsConfigured}
            signupUrl="https://console.cloud.google.com/google/maps-apis"
            signupLabel="Enable Maps APIs"
            manageUrl="https://console.cloud.google.com/google/maps-apis"
            envHint="Enable Maps JavaScript, Drawing, Geometry, Places, and Geocoding. Then set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."
          />
        </div>
      </section>
    </div>
  );
}

function IntegrationCard({
  title,
  description,
  envReady,
  connected,
  connectedTo,
  signupUrl,
  signupLabel,
  connectHref,
  manageUrl,
  disconnectAction,
  envHint,
}: {
  title: string;
  description: string;
  envReady: boolean;
  connected: boolean;
  connectedTo?: string | null;
  signupUrl: string;
  signupLabel?: string;
  connectHref?: string;
  manageUrl?: string;
  disconnectAction?: () => Promise<void>;
  envHint?: string;
}) {
  // Decide where the whole card click should go.
  // - connected: open the service's management console (new tab)
  // - env vars set but OAuth not done: in-app connect flow
  // - nothing configured: open the service's signup page (new tab)
  const state: "connected" | "ready" | "needs_setup" = connected
    ? "connected"
    : envReady
      ? "ready"
      : "needs_setup";

  const primaryHref =
    state === "connected"
      ? manageUrl ?? signupUrl
      : state === "ready" && connectHref
        ? connectHref
        : signupUrl;
  const primaryExternal = state !== "ready";
  const primaryLabel =
    state === "connected"
      ? "Manage"
      : state === "ready"
        ? "Connect"
        : signupLabel ?? "Set up";

  const stateBadge =
    state === "connected" ? (
      <span className="badge bg-green-100 text-green-700 whitespace-nowrap">
        Connected{connectedTo ? ` · ${connectedTo}` : ""}
      </span>
    ) : state === "ready" ? (
      <span className="badge bg-yellow-100 text-yellow-700 whitespace-nowrap">Ready to connect</span>
    ) : (
      <span className="badge bg-gray-100 text-gray-700 whitespace-nowrap">Not set up</span>
    );

  const Wrapper: any = primaryExternal ? "a" : Link;
  const wrapperProps = primaryExternal
    ? { href: primaryHref, target: "_blank", rel: "noopener noreferrer" }
    : { href: primaryHref };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-brand-300 hover:shadow-sm transition">
      <Wrapper
        {...wrapperProps}
        className="block px-4 py-3 hover:bg-brand-50/40 focus-visible:bg-brand-50/40 outline-none"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              {stateBadge}
            </div>
            <p className="text-xs text-gray-600 mt-1">{description}</p>
            {state === "needs_setup" && envHint && (
              <p className="text-[11px] text-gray-500 mt-1">{envHint}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
              {primaryLabel}
              {primaryExternal ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </span>
          </div>
        </div>
      </Wrapper>
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

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200";
  return <div className={`border rounded-md p-3 text-sm mb-4 ${cls}`}>{children}</div>;
}
