import { getDriveAccessToken } from "@/lib/drive-uploader";
import { uploadFile } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";

/**
 * Save a receipt photo. Prefers the org's connected Google Drive (Receipts folder).
 * Falls back to Supabase Storage (photos bucket) if Drive isn't connected or fails.
 * Returns a viewable URL or null on failure.
 */
export async function uploadReceipt(
  file: File,
  organizationId: string,
  vendorHint?: string | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  // Sanitize extension to only a-z 0-9 (no path traversal, no shell chars)
  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ext = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
  const date = new Date().toISOString().slice(0, 10);
  const slug = (vendorHint || "receipt")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "receipt";
  // Filename is fully server-controlled — no user input is interpolated as-is
  const filename = `${date}-${slug}-${Date.now()}-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}.${ext}`;
  const mimeType = file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg");

  // Try Google Drive
  try {
    const t = await getDriveAccessToken(organizationId);
    if (t?.conn.receipts_folder_id) {
      const uploaded = await uploadFile({
        access_token: t.token,
        parentFolderId: t.conn.receipts_folder_id,
        name: filename,
        mimeType,
        body: file,
      });
      return uploaded.webViewLink;
    }
  } catch (err) {
    console.error("Drive receipt upload failed, falling back to storage:", err);
  }

  // Fallback: Supabase Storage
  try {
    const supabase = await createClient();
    const path = `${organizationId}/receipts/${filename}`;
    const bytes = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from("photos").upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed?.signedUrl ?? null;
  } catch (err) {
    console.error("Storage receipt upload failed:", err);
    return null;
  }
}
