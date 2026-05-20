import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { setOnboardingStep, mergeOnboardingData } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";
import { tierFor } from "@/lib/billing";

export const dynamic = "force-dynamic";

async function saveMessaging(formData: FormData) {
  "use server";
  const ctx = await loadWizardContext("messaging");

  const sender_email = String(formData.get("sender_email") ?? "").trim() || null;
  const sender_name = String(formData.get("sender_name") ?? "").trim() || null;
  const sms_area_code = String(formData.get("sms_area_code") ?? "").trim() || null;
  const skip_sms = formData.get("skip_sms") === "on";

  // Persist the sender email + name into the (per-org) messaging row.
  // The pre-verify state lives in onboarding_data — the platform sender
  // gets verified out-of-band via Resend, and a real verified address
  // replaces the placeholder later.
  if (sender_email) {
    await ctx.supabase
      .from("org_messaging_credentials")
      .upsert(
        {
          organization_id: ctx.organizationId,
          resend_from: sender_name ? `${sender_name} <${sender_email}>` : sender_email,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "organization_id" },
      );
  }

  await mergeOnboardingData(ctx.organizationId, {
    messaging: {
      sender_email,
      sender_name,
      sms_area_code,
      sms_skipped: skip_sms,
      // Set when the user actually has a verified inbox / provisioned number.
      sender_email_verified: false,
      sms_number_provisioned: false,
    },
  });

  await setOnboardingStep(ctx.organizationId, "finish");
  redirect("/onboarding/finish");
}

export default async function MessagingStep({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const ctx = await loadWizardContext("messaging");
  const params = await searchParams;

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("subscription_tier, email, onboarding_data, name")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const { data: creds } = await ctx.supabase
    .from("org_messaging_credentials")
    .select("resend_from")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  const tier = tierFor((org as any)?.subscription_tier);
  const hasMessagingQuota = tier.emailPerMonth > 0 || tier.smsPerMonth > 0;
  const prev = ((org as any)?.onboarding_data?.messaging ?? {}) as {
    sender_email?: string;
    sender_name?: string;
    sms_area_code?: string;
    sms_skipped?: boolean;
  };

  const defaultSenderEmail = prev.sender_email ?? (org as any)?.email ?? "";
  const defaultSenderName = prev.sender_name ?? (org as any)?.name ?? "";

  return (
    <>
      <OnboardingProgress step="messaging" />
      <WizardCard>
        {params?.billing === "ok" && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            ✓ Card saved. Your free trial is active.
          </div>
        )}
        <h1 className="text-xl font-semibold mb-1">Set up email &amp; SMS</h1>
        <p className="text-sm text-gray-600 mb-5">
          {hasMessagingQuota
            ? "Configure what shows up as the sender when you send estimates, invoices, and review requests."
            : "Your plan doesn't include email or SMS. You can still configure a sender for when you upgrade. Skip this step otherwise."}
        </p>

        <form action={saveMessaging} className="space-y-5">
          <fieldset>
            <legend className="font-medium text-sm mb-2">Sender email</legend>
            <p className="text-xs text-gray-500 mb-2">
              We&rsquo;ll send a verification email to confirm this address before any
              customer-facing messages go out from it.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label>Display name</label>
                <input
                  name="sender_name"
                  defaultValue={defaultSenderName}
                  placeholder="Acme Home Services"
                  className="w-full"
                />
              </div>
              <div>
                <label>Email address</label>
                <input
                  name="sender_email"
                  type="email"
                  defaultValue={defaultSenderEmail}
                  placeholder="hello@acme.com"
                  className="w-full"
                />
              </div>
            </div>
            {creds && (creds as any).resend_from && (
              <p className="text-xs text-gray-500 mt-2">
                Currently: <code>{(creds as any).resend_from}</code>
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-medium text-sm mb-2">SMS sender number</legend>
            <p className="text-xs text-gray-500 mb-2">
              Pick an area code and we&rsquo;ll provision a local number for outbound SMS
              after onboarding. You can also skip and add this from Settings later.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                name="sms_area_code"
                inputMode="numeric"
                pattern="[0-9]{3}"
                maxLength={3}
                defaultValue={prev.sms_area_code ?? ""}
                placeholder="555"
                className="w-28"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="skip_sms"
                  defaultChecked={prev.sms_skipped ?? false}
                />
                Skip for now
              </label>
            </div>
          </fieldset>

          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
            Either field can be left blank — we&rsquo;ll remind you from the dashboard
            if it isn&rsquo;t finished. You won&rsquo;t be stuck.
          </div>

          <div className="flex justify-between pt-2">
            <a href="/onboarding/billing" className="btn-secondary">← Back</a>
            <button type="submit" className="btn-primary">Continue →</button>
          </div>
        </form>
      </WizardCard>
    </>
  );
}
