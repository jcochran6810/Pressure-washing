// Loads per-org messaging credentials. The "platform fallback" (env vars) only
// kicks in when an org hasn't entered their own — for the BYOC plan we treat the
// org as the source of truth.

import { createClient } from "@/lib/supabase/server";
import { sendEmail, type EmailResult } from "@/lib/email";

export type OrgMessagingCreds = {
  resendApiKey: string | null;
  resendFrom: string | null;
  telnyxApiKey: string | null;
  telnyxFromNumber: string | null;
  addonEnabled: boolean;
};

const EMPTY: OrgMessagingCreds = {
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
  return {
    resendApiKey: data.resend_api_key ?? null,
    resendFrom: data.resend_from ?? null,
    telnyxApiKey: data.telnyx_api_key ?? null,
    telnyxFromNumber: data.telnyx_from_number ?? null,
    addonEnabled: Boolean(data.messaging_addon_enabled),
  };
}

// Convenience wrapper: send a one-off email using the org's Resend creds when
// present, falling back to the platform env vars. Use this from server actions
// instead of calling sendEmail directly, so each org's send cost is on them.
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
