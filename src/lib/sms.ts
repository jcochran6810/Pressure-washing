// Telnyx SMS sender. Set TELNYX_API_KEY and TELNYX_FROM_NUMBER in .env.local.
// Uses fetch to avoid an extra dependency.

type SmsResult = { ok: true; id: string } | { ok: false; reason: string };

type SendArgs = {
  to: string;
  body: string;
  from?: string;
  messagingProfileId?: string;
};

export async function sendSms(args: SendArgs): Promise<SmsResult> {
  const key = process.env.TELNYX_API_KEY;
  const from = args.from || process.env.TELNYX_FROM_NUMBER || "";
  if (!key) return { ok: false, reason: "TELNYX_API_KEY not set" };
  if (!from && !args.messagingProfileId) {
    return { ok: false, reason: "Set TELNYX_FROM_NUMBER or pass a messagingProfileId" };
  }

  const payload: Record<string, unknown> = {
    to: args.to,
    text: args.body,
  };
  if (args.messagingProfileId) payload.messaging_profile_id = args.messagingProfileId;
  if (from) payload.from = from;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: text || `Telnyx ${res.status}` };
  }
  const data = await res.json();
  return { ok: true, id: data?.data?.id ?? "" };
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}
