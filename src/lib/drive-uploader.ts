import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, uploadFile, ensureFolder } from "@/lib/google-drive";

export async function getDriveAccessToken(organization_id: string) {
  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("google_drive_connections")
    .select("*")
    .eq("organization_id", organization_id)
    .single();
  if (!conn) return null;

  const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) {
    return { token: conn.access_token, conn };
  }
  const refreshed = await refreshAccessToken(conn.refresh_token);
  await supabase.from("google_drive_connections").update({
    access_token: refreshed.access_token,
    access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("organization_id", organization_id);
  return { token: refreshed.access_token, conn };
}

export async function uploadHtmlToDrive(opts: {
  organization_id: string;
  folder: "invoices_folder_id" | "estimates_folder_id" | "photos_folder_id" | "receipts_folder_id";
  name: string;
  html: string;
}) {
  const t = await getDriveAccessToken(opts.organization_id);
  if (!t) throw new Error("Drive not connected for this organization.");
  const parent = (t.conn as any)[opts.folder] as string | undefined;
  if (!parent) throw new Error("Drive folder missing — reconnect.");
  return uploadFile({
    access_token: t.token,
    parentFolderId: parent,
    name: opts.name,
    mimeType: "text/html",
    body: opts.html,
  });
}

// Archive every line-item photo + job before/after photo to the org's Drive
// under "Job Photos/<invoice_number>/...". Best-effort: any failure is
// logged but doesn't break the payment flow.
export async function archiveInvoicePhotosToDrive(opts: {
  organization_id: string;
  invoice_number: string;
  photoUrls: string[];
}): Promise<{ uploaded: number; skipped: number }> {
  const result = { uploaded: 0, skipped: 0 };
  if (!opts.photoUrls.length) return result;
  const t = await getDriveAccessToken(opts.organization_id);
  if (!t) return result; // No Drive connected — skip silently
  const photosFolder = (t.conn as any).photos_folder_id as string | undefined;
  if (!photosFolder) return result;

  // Sub-folder per invoice so it's easy to find every artifact for one job.
  const invoiceFolder = await ensureFolder(t.token, opts.invoice_number, photosFolder);

  let i = 0;
  for (const url of opts.photoUrls) {
    if (!url) { result.skipped++; continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) { result.skipped++; continue; }
      const blob = await res.blob();
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      i++;
      await uploadFile({
        access_token: t.token,
        parentFolderId: invoiceFolder,
        name: `${String(i).padStart(3, "0")}.${ext}`,
        mimeType: contentType,
        body: blob,
      });
      result.uploaded++;
    } catch (e) {
      console.error("archiveInvoicePhotosToDrive failed for url:", url, e);
      result.skipped++;
    }
  }
  return result;
}
