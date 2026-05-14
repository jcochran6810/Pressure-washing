import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, ensureFolder, userInfo } from "@/lib/google-drive";
import { listCalendars } from "@/lib/google-calendar";
import { DRIVE_ROOT_FOLDER_NAME } from "@/lib/platform";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/settings?google=error", request.url));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Verify state — must match user's org
  const { data: member } = await supabase.from("organization_members").select("organization_id").eq("organization_id", state).eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.redirect(new URL("/settings?google=unauthorized", request.url));
  const organization_id = state;

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/settings?google=no_refresh_token", request.url));
    }

    const me = await userInfo(tokens.access_token);

    // Create folder structure
    const root = await ensureFolder(tokens.access_token, DRIVE_ROOT_FOLDER_NAME);
    const [invoices, estimates, photos, receipts] = await Promise.all([
      ensureFolder(tokens.access_token, "Invoices", root),
      ensureFolder(tokens.access_token, "Estimates", root),
      ensureFolder(tokens.access_token, "Job Photos", root),
      ensureFolder(tokens.access_token, "Receipts", root),
    ]);

    // Default-pick the user's primary calendar so /calendar works immediately.
    // They can pick a different one in settings.
    let calendarId: string | null = null;
    let calendarName: string | null = null;
    try {
      const calendars = await listCalendars(tokens.access_token);
      const primary = calendars.find((c) => c.primary) ?? calendars[0];
      if (primary) {
        calendarId = primary.id;
        calendarName = primary.summary;
      }
    } catch (e) {
      // Calendar scope might have been declined — proceed without it.
      console.error("Calendar list failed:", e);
    }

    await supabase.from("google_drive_connections").upsert({
      organization_id,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      drive_folder_id: root,
      invoices_folder_id: invoices,
      estimates_folder_id: estimates,
      photos_folder_id: photos,
      receipts_folder_id: receipts,
      scopes: tokens.scope.split(" "),
      connected_email: me?.email ?? null,
      calendar_id: calendarId,
      calendar_name: calendarName,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.redirect(new URL(`/settings?google=error&msg=${encodeURIComponent(err.message)}`, request.url));
  }
  return NextResponse.redirect(new URL("/settings?google=connected", request.url));
}
