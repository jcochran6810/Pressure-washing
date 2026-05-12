"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PhotoKind = "before" | "after" | "damage" | "reference" | "other";

export function PhotoUploader({
  organizationId,
  targetType,
  targetId,
  customerId,
  kind = "before",
  onUploaded,
}: {
  organizationId: string;
  targetType: "estimate" | "job" | "invoice" | "property";
  targetId: string;
  customerId?: string | null;
  kind?: PhotoKind;
  onUploaded?: () => void;
}) {
  const [selectedKind, setSelectedKind] = useState<PhotoKind>(kind);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const supabase = createClient();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${organizationId}/${targetType}s/${targetId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
      if (upErr) { setErr(upErr.message); setBusy(false); return; }
      const { data: signed } = await supabase.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? path;

      const row: any = {
        organization_id: organizationId,
        kind: selectedKind,
        url,
        customer_id: customerId ?? null,
      };
      if (targetType === "estimate") row.estimate_id = targetId;
      if (targetType === "job") row.job_id = targetId;
      if (targetType === "invoice") row.invoice_id = targetId;
      if (targetType === "property") row.property_id = targetId;

      await supabase.from("photo_attachments").insert(row);
    }
    setBusy(false);
    onUploaded?.();
    location.reload();
  }

  return (
    <div className="border border-dashed border-gray-300 rounded-md p-3 text-center text-sm">
      <div className="flex justify-center gap-2 mb-2">
        {(["before", "after", "damage", "reference"] as PhotoKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSelectedKind(k)}
            className={`px-2 py-1 rounded-full text-xs ${selectedKind === k ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <input
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={busy}
        className="text-xs"
      />
      <p className="text-xs text-gray-500 mt-1">
        {busy ? "Uploading…" : "Tap to upload from camera or library"}
      </p>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
