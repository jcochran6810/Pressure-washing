import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { setOnboardingStep } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";

export const dynamic = "force-dynamic";

async function saveBusiness(formData: FormData) {
  "use server";
  const ctx = await loadWizardContext("business");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address_line1 = String(formData.get("address_line1") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const postal_code = String(formData.get("postal_code") ?? "").trim() || null;
  const owner_name = String(formData.get("owner_name") ?? "").trim() || null;

  if (!name) throw new Error("Business name is required.");

  await ctx.supabase
    .from("organizations")
    .update({
      name,
      phone,
      email,
      address_line1,
      city,
      state,
      postal_code,
    } as any)
    .eq("id", ctx.organizationId);

  if (owner_name) {
    await ctx.supabase
      .from("profiles")
      .update({ full_name: owner_name } as any)
      .eq("id", ctx.userId);
  }

  await setOnboardingStep(ctx.organizationId, "trades");
  redirect("/onboarding/trades");
}

export default async function BusinessStep() {
  const ctx = await loadWizardContext("business");
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("name, phone, email, address_line1, city, state, postal_code")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();
  const o = (org as any) ?? {};
  const p = (profile as any) ?? {};

  return (
    <>
      <OnboardingProgress step="business" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">Tell us about your business</h1>
        <p className="text-sm text-gray-600 mb-5">
          This shows up on your estimates, invoices, and customer-facing pages.
        </p>
        <form action={saveBusiness} className="space-y-4">
          <div>
            <label>Business name *</label>
            <input
              name="name"
              required
              defaultValue={o.name === "My Business" ? "" : o.name ?? ""}
              placeholder="e.g. Acme Home Services"
              className="w-full"
            />
          </div>
          <div>
            <label>Owner / your name</label>
            <input
              name="owner_name"
              defaultValue={p.full_name ?? ""}
              placeholder="Jane Doe"
              className="w-full"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label>Business phone</label>
              <input
                name="phone"
                type="tel"
                defaultValue={o.phone ?? ""}
                placeholder="(555) 123-4567"
                className="w-full"
              />
            </div>
            <div>
              <label>Business email</label>
              <input
                name="email"
                type="email"
                defaultValue={o.email ?? ""}
                placeholder="info@example.com"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label>Street address</label>
            <input
              name="address_line1"
              defaultValue={o.address_line1 ?? ""}
              placeholder="123 Main St"
              className="w-full"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label>City</label>
              <input name="city" defaultValue={o.city ?? ""} className="w-full" />
            </div>
            <div>
              <label>State</label>
              <input name="state" defaultValue={o.state ?? ""} className="w-full" />
            </div>
            <div>
              <label>ZIP</label>
              <input name="postal_code" defaultValue={o.postal_code ?? ""} className="w-full" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">Continue →</button>
          </div>
        </form>
      </WizardCard>
    </>
  );
}
