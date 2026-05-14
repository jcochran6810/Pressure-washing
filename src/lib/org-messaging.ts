// Per-org messaging credentials with two modes:
//   - 'platform' (default): platform Resend/Telnyx env vars carry the send,
//     billed as part of the org's subscription tier.
//   - 'byoc': the org has provided their own Resend/Telnyx keys. We decrypt
//     them and pass them through to the senders so the send hits their account.
//
// All BYOC keys are AES-256-GCM encrypted at rest with MESSAGING_SECRET; only
// the decrypted form ever touches the senders. RLS limits row access to org
// owners/admins, but encryption defends against a leaked anon key bypass.

import { createClient } from "@/lib/supabase/server";
import { sendEmail, type EmailResult } from "@/lib/email";
import { decryptString } from "@/lib/crypto";

export type MessagingMode = "platform" | "byoc";

export type OrgMessagingCreds = {
  mode: MessagingMode;
  resendApiKey: string | null;
  resendFrom: string | null;
  telnyxApiKey: string | null;
  telnyxFromNumber: string | null;
  addonEnabled: boolean;
};

const EMPTY: OrgMessagingCreds = {
  mode: "platform",
  resendApiKey: null,
  resendFrom: null,
  telnyxApiKey: null,
  telnyxFromNumber: null,
  addonEnabled: false,
};

export async function loadOrgMessagingCreds(organization_id: string): Promise<OrgMessagingCreds> {
  if (!organization_id) return EMPTY;
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_messaging_credentials")
    .select("*")
    .eq("organization_id", organization_id)
    .maybeSingle();
  if (!data) return EMPTY;

  const mode: MessagingMode = data.messaging_mode === "byoc" ? "byoc" : "platform";

  // Only decrypt and surface BYOC keys when the org has explicitly opted in.
  // In platform mode we deliberately ignore stored creds so a forgotten BYOC
  // key can't accidentally route messages through the wrong account.
  if (mode !== "byoc") {
    return { ...EMPTY, mode, addonEnabled: Boolean(data.messaging_addon_enabled) };
  }

  return {
    mode,
    resendApiKey: decryptString(data.resend_api_key),
    resendFrom: data.resend_from ?? null,
    telnyxApiKey: decryptString(data.telnyx_api_key),
    telnyxFromNumber: decryptString(data.telnyx_from_number),
    addonEnabled: Boolean(data.messaging_addon_enabled),
  };
}

export async function sendOrgEmail(
  organization_id: string,
  args: { to: string; subject: string; html: string; replyTo?: string },
): Promise<EmailResult> {
  const creds = await loadOrgMessagingCreds(organization_id);
  return sendEmail({
    ...args,
    apiKey: creds.resendApiKey ?? undefined,
    from: creds.resendFrom ?? undefined,
  });
}
