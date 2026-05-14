import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, ensureFolder, userInfo } from "@/lib/google-drive";
import { listCalendars } from "@/lib/google-calendar";
import { DRIVE_ROOT_FOLDER_NAME } from "@/lib/platform";

// Returns a tiny HTML page that posts the OAuth result back to the opener
// window and closes itself. Falls back to a full-page redirect when there's
// no opener (popup was blocked → user got the redirect flow instead).
function popupResponse(status: string, msg?: string | null): Response {
  const fallbackUrl = `/settings?google=${encodeURIComponent(status)}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}`;
  const payload = JSON.stringify({
    source: "pw-oauth-google",
    status,
    msg: msg ?? null,
  });
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Returning…</title></head>
<body style="font-family:system-ui;padding:24px;color:#374151">
<p>Returning to app…</p>
<script>
(function(){
  var msg = ${payload};
  var fallback = ${JSON.stringify(fallbackUrl)};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, window.location.origin);
      window.close();
      return;
    }
  } catch (e) {}
  window.location.replace(fallback);
})();
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return popupResponse("error", "missing code or state");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", state)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return popupResponse("unauthorized");
  const organization_id = state;

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      return popupResponse("no_refresh_token");
    }

    const me = await userInfo(tokens.access_token);

    const root = await ensureFolder(tokens.access_token, DRIVE_ROOT_FOLDER_NAME);
    const [invoices, estimates, photos, receipts] = await Promise.all([
      ensureFolder(tokens.access_token, "Invoices", root),
      ensureFolder(tokens.access_token, "Estimates", root),
      ensureFolder(tokens.access_token, "Job Photos", root),
      ensureFolder(tokens.access_token, "Receipts", root),
    ]);

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
    return popupResponse("error", err.message);
  }
  return popupResponse("connected");
}
