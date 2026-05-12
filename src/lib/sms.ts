// Twilio SMS. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER
// in .env.local. Uses the REST API via fetch so we don't need the SDK.

type SendArgs = { to: string; body: string };

export function isSMSConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

/**
 * Convert a free-form US phone number to E.164 for Twilio.
 *   "(555) 123-4567" -> "+15551234567"
 *   "555-123-4567"   -> "+15551234567"
 *   "+44 20 7946 0958" -> "+442079460958"
 * Returns null if the number does not parse to a plausible E.164.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/[^\d]/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSMS(
  args: SendArgs,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  if (!isSMSConfigured()) return { ok: false, reason: "Twilio not configured" };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const to = normalizePhone(args.to);
  if (!to) return { ok: false, reason: "Invalid phone number" };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: args.body }).toString(),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, reason: text };
  }
  const data: any = await res.json();
  return { ok: true, id: data.sid as string };
}

/**
 * Pick the customer's best SMS-eligible phone number — mobile first, then
 * the main phone. Returns null if neither is a valid SMS target.
 */
export function bestCustomerPhone(
  customer: { mobile_phone?: string | null; phone?: string | null } | null | undefined,
): string | null {
  if (!customer) return null;
  return normalizePhone(customer.mobile_phone) ?? normalizePhone(customer.phone);
}
