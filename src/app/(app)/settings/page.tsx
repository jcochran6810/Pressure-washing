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
          />
        </div>
      </section>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-1">Platform services</h2>
        <p className="text-xs text-gray-500 mb-3">
          These run on the app's shared infrastructure — nothing for you to set up.
        </p>
        <div className="space-y-2 text-sm">
          <PlatformServiceRow
            title="Email delivery"
            description="Sends estimate, invoice, and receipt emails to your customers."
            active={emailConfigured}
          />
          <PlatformServiceRow
            title="SMS delivery"
            description="Sends appointment reminders and links via text message."
            active={telnyxConfigured}
          />
          <PlatformServiceRow
            title="Satellite imagery"
            description="Powers polygon measurements on satellite maps."
            active={mapsConfigured}
          />
          <PlatformServiceRow
            title="Online payments (Stripe)"
            description="Adds a Pay Now link to invoices."
            active={stripeConfigured}
            note="Currently routes payments to the platform Stripe account. Per-business Stripe Connect coming soon."
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
}: {
  title: string;
  description: string;
  available: boolean;
  connected: boolean;
  connectedTo?: string | null;
  connectHref: string;
  manageUrl?: string;
  disconnectAction?: () => Promise<void>;
}) {
  // Three states from the user's POV:
  // 1. Connected → tapping opens the service's management dashboard.
  // 2. Available, not connected → tapping starts the in-app OAuth flow.
  // 3. Not available on this deployment → read-only; ask support.
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
      <span className="badge bg-gray-100 text-gray-700 whitespace-nowrap">Currently unavailable</span>
    );

  const inner = (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {stateBadge}
        </div>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
        {state === "unavailable" && (
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
        <Link
          href={connectHref}
          className="block px-4 py-3 hover:bg-brand-50/40 focus-visible:bg-brand-50/40 outline-none"
        >
          {inner}
        </Link>
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

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200";
  return <div className={`border rounded-md p-3 text-sm mb-4 ${cls}`}>{children}</div>;
}
