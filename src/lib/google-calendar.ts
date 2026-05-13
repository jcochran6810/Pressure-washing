// Google Calendar read-only helpers. Uses the same OAuth refresh token stored in
// google_drive_connections — we just request an additional calendar.readonly
// scope when the user connects their Google account.

import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/google-drive";

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
};

export type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  colorId?: string;
};

export async function getCalendarAccessToken(organization_id: string): Promise<{
  token: string;
  conn: any;
} | null> {
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("google_drive_connections")
    .select("*")
    .eq("organization_id", organization_id)
    .single();
  if (!conn) return null;

  const scopes = (conn.scopes as string[] | null) ?? [];
  const hasCalendar = scopes.some((s) => s.includes("calendar"));
  if (!hasCalendar) return null;

  const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) {
    return { token: conn.access_token, conn };
  }
  const refreshed = await refreshAccessToken(conn.refresh_token);
  await supabase
    .from("google_drive_connections")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organization_id);
  return { token: refreshed.access_token, conn };
}

export async function listCalendars(access_token: string): Promise<GoogleCalendar[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,primary,backgroundColor)", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error(`Calendar list failed: ${await res.text()}`);
  const data = await res.json();
  return (data.items ?? []) as GoogleCalendar[];
}

export async function listEvents(opts: {
  access_token: string;
  calendar_id: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: opts.timeMin.toISOString(),
    timeMax: opts.timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    opts.calendar_id,
  )}/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${opts.access_token}` },
  });
  if (!res.ok) throw new Error(`Calendar events failed: ${await res.text()}`);
  const data = await res.json();
  return (data.items ?? []) as GoogleEvent[];
}
