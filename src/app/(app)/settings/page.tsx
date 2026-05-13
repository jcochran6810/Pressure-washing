import { getSessionAndOrg } from "@/lib/org";
import { updateOrganization, disconnectGoogleDrive } from "./actions";
import { getCalendarAccessToken, listCalendars, type GoogleCalendar } from "@/lib/google-calendar";
import { CalendarPicker } from "@/components/calendar-picker";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string; msg?: string }> }) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { google, msg } = await searchParams;
  const { data: drive } = await supabase.from("google_drive_connections").select("*").eq("organization_id", organizationId).maybeSingle();

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

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-5">Settings</h1>

      {google === "connected" && <Notice tone="ok">Google Drive connected.</Notice>}
      {google === "error" && <Notice tone="error">Google Drive connect failed{msg ? `: ${msg}` : "."}</Notice>}
      {google === "no_refresh_token" && <Notice tone="error">Google didn't return a refresh token. Revoke access in your Google account and try again.</Notice>}

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
        <h2 className="font-semibold mb-3">Integrations</h2>
        <div className="space-y-3 text-sm">
          <IntegrationRow
            title="Google Drive & Calendar"
            description="Save invoices, estimates, receipts, and job photos to Drive — and pull events from a Google Calendar into the in-app calendar."
            configured={googleConfigured}
            connected={Boolean(drive)}
            connectedTo={drive?.connected_email ?? null}
            connectHref="/api/google/connect"
            disconnectAction={disconnectGoogleDrive}
            setupHint="Create OAuth credentials in Google Cloud Console and set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env.local."
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
          <IntegrationRow
            title="Resend (email receipts)"
            description="Automatically email PAID receipts and invoices to customers."
            configured={emailConfigured}
            connected={emailConfigured}
            setupHint="Sign up at resend.com and set RESEND_API_KEY + RESEND_FROM in .env.local."
          />
          <IntegrationRow
            title="Google Maps (satellite measurements)"
            description="Powers the polygon measurement tool on satellite imagery."
            configured={mapsConfigured}
            connected={mapsConfigured}
            setupHint="In Google Cloud Console enable Maps JavaScript, Drawing, Geometry, Places, and Geocoding APIs. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."
          />
          <IntegrationRow
            title="Stripe (online payments)"
            description="Create payment links on invoices and auto-record payments when paid."
            configured={stripeConfigured}
            connected={stripeConfigured}
            setupHint="Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env.local."
          />
        </div>
      </section>
    </div>
  );
}

function IntegrationRow({
  title,
  description,
  configured,
  connected,
  connectedTo,
  connectHref,
  disconnectAction,
  setupHint,
}: {
  title: string;
  description: string;
  configured: boolean;
  connected: boolean;
  connectedTo?: string | null;
  connectHref?: string;
  disconnectAction?: () => Promise<void>;
  setupHint?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          {connected ? (
            <span className="badge bg-green-100 text-green-700">Connected{connectedTo ? ` · ${connectedTo}` : ""}</span>
          ) : configured ? (
            <span className="badge bg-yellow-100 text-yellow-700">Not connected</span>
          ) : (
            <span className="badge bg-gray-100 text-gray-700">Not configured</span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
        {!configured && setupHint && <p className="text-xs text-gray-500 mt-1">{setupHint}</p>}
      </div>
      <div className="flex gap-2 items-center">
        {configured && !connected && connectHref && (
          <a href={connectHref} className="btn-secondary text-xs py-1 px-2">Connect</a>
        )}
        {connected && disconnectAction && (
          <form action={disconnectAction}><button className="btn-ghost text-red-600 text-xs">Disconnect</button></form>
        )}
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200";
  return <div className={`border rounded-md p-3 text-sm mb-4 ${cls}`}>{children}</div>;
}
