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

  // Tax + legal block. All optional — sole props without an EIN should
  // still be able to finish onboarding. Empty strings normalise to null
  // so we don't fail the EIN format check on blanks.
  const legal_business_name = String(formData.get("legal_business_name") ?? "").trim() || null;
  const business_structure = String(formData.get("business_structure") ?? "").trim() || null;
  const tax_id_type = String(formData.get("tax_id_type") ?? "").trim() || null;
  const tax_id_raw = String(formData.get("tax_id") ?? "").trim();
  const state_tax_id = String(formData.get("state_tax_id") ?? "").trim() || null;
  const tax_rate_raw = String(formData.get("tax_rate") ?? "").trim();

  if (!name) throw new Error("Business name is required.");

  // Normalise EIN/SSN to digits only — humans paste "12-3456789" or
  // "123-45-6789", IRS lookups want digits. Don't enforce length though;
  // SSN/ITIN are 9 digits, EIN is 9 digits, but partial entry shouldn't
  // block the wizard.
  const tax_id = tax_id_raw ? tax_id_raw.replace(/[^0-9]/g, "") || null : null;

  // Accept tax_rate as either decimal (0.0825) or percent (8.25). If the
  // value is > 1 we assume the user meant a percentage and divide.
  let tax_rate: number | null = null;
  if (tax_rate_raw) {
    const n = Number(tax_rate_raw);
    if (Number.isFinite(n) && n >= 0) tax_rate = n > 1 ? n / 100 : n;
  }

  const patch: Record<string, unknown> = {
    name,
    phone,
    email,
    address_line1,
    city,
    state,
    postal_code,
    legal_business_name,
    business_structure,
    tax_id_type: tax_id_type || (tax_id ? "EIN" : "none"),
    tax_id,
    state_tax_id,
  };
  if (tax_rate !== null) patch.tax_rate = tax_rate;

  await ctx.supabase
    .from("organizations")
    .update(patch as any)
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
    .select(
      "name, phone, email, address_line1, city, state, postal_code, legal_business_name, business_structure, tax_id_type, tax_id, state_tax_id, tax_rate",
    )
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();
  const o = (org as any) ?? {};
  const p = (profile as any) ?? {};

  // Show stored tax_rate as a percentage for human readability — the form
  // accepts either decimal or percent on save.
  const taxRatePercent = o.tax_rate != null ? Number(o.tax_rate) * 100 : "";

  return (
    <>
      <OnboardingProgress step="business" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">Tell us about your business</h1>
        <p className="text-sm text-gray-600 mb-5">
          This shows up on your estimates, invoices, and customer-facing pages.
        </p>
        <form action={saveBusiness} className="space-y-5">
          <section className="space-y-4">
            <div>
              <label>Business name (DBA) *</label>
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
                <input name="phone" type="tel" defaultValue={o.phone ?? ""} placeholder="(555) 123-4567" className="w-full" />
              </div>
              <div>
                <label>Business email</label>
                <input name="email" type="email" defaultValue={o.email ?? ""} placeholder="info@example.com" className="w-full" />
              </div>
            </div>
            <div>
              <label>Street address</label>
              <input name="address_line1" defaultValue={o.address_line1 ?? ""} placeholder="123 Main St" className="w-full" />
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
          </section>

          <section className="pt-3 border-t border-gray-200">
            <h2 className="font-medium mb-1">Tax &amp; legal</h2>
            <p className="text-xs text-gray-500 mb-4">
              Used on customer-facing documents and for year-end reports. All optional &mdash;
              you can fill these in later from Settings.
            </p>

            <div className="space-y-4">
              <div>
                <label>Legal business name</label>
                <input
                  name="legal_business_name"
                  defaultValue={o.legal_business_name ?? ""}
                  placeholder="If different from DBA, e.g. Acme Services LLC"
                  className="w-full"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label>Business structure</label>
                  <select
                    name="business_structure"
                    defaultValue={o.business_structure ?? ""}
                    className="w-full"
                  >
                    <option value="">— Select —</option>
                    <option value="sole_prop">Sole proprietor</option>
                    <option value="llc">LLC</option>
                    <option value="scorp">S-Corp</option>
                    <option value="ccorp">C-Corp</option>
                    <option value="partnership">Partnership</option>
                    <option value="nonprofit">Non-profit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label>Tax ID type</label>
                  <select
                    name="tax_id_type"
                    defaultValue={o.tax_id_type ?? ""}
                    className="w-full"
                  >
                    <option value="">— Select —</option>
                    <option value="EIN">EIN (most businesses)</option>
                    <option value="SSN">SSN (sole prop, no EIN)</option>
                    <option value="ITIN">ITIN</option>
                    <option value="none">None / not yet</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label>Federal tax ID</label>
                  <input
                    name="tax_id"
                    inputMode="numeric"
                    defaultValue={o.tax_id ?? ""}
                    placeholder="12-3456789"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Stored numbers-only. Used on 1099s and account export.
                  </p>
                </div>
                <div>
                  <label>State sales-tax / vendor ID</label>
                  <input
                    name="state_tax_id"
                    defaultValue={o.state_tax_id ?? ""}
                    placeholder="optional"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label>Default sales-tax rate</label>
                <div className="flex items-center gap-2">
                  <input
                    name="tax_rate"
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    defaultValue={taxRatePercent === "" ? "" : Number(taxRatePercent).toFixed(3)}
                    placeholder="8.25"
                    className="w-32"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pre-fills new estimates and invoices. You can override on each document.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">Continue →</button>
          </div>
        </form>
      </WizardCard>
    </>
  );
}
