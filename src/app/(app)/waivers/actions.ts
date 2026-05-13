"use server";

import { getSessionAndOrg } from "@/lib/org";
import { parseForm, waiverSchema } from "@/lib/validation";
import { sendTemplated, appUrl } from "@/lib/messaging";
import { customerDisplayName } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DEFAULT_WAIVER = `LIABILITY WAIVER & PROPERTY ACCESS AGREEMENT

By signing below, I authorize {{org_name}} to access the property at the agreed address to perform pressure-washing services described in the related estimate.

I acknowledge:
1. Existing damage (loose paint, rotten wood, cracked windows, etc.) may be exposed or worsened by cleaning.
2. The company will use reasonable care, including soft-wash methods where appropriate.
3. I will move or secure outdoor furniture, vehicles, plants, and pets prior to service.
4. The company is not liable for pre-existing conditions that fail during cleaning.
5. I am the property owner or am authorized by the owner to approve this work.

I have read and agree to the above terms.`;

export async function createWaiver(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const v = parseForm(waiverSchema, formData);
  const { data: w, error } = await (supabase as any)
    .from("waivers")
    .insert({
      organization_id: organizationId,
      name: v.name,
      body: v.body,
      active: v.active,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/waivers");
  redirect(`/waivers/${w.id}`);
}

export async function seedDefaultWaiver() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { count } = await (supabase as any)
    .from("waivers")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if ((count ?? 0) > 0) return;
  await (supabase as any).from("waivers").insert({
    organization_id: organizationId,
    name: "Standard service waiver",
    body: DEFAULT_WAIVER,
    active: true,
  });
  revalidatePath("/waivers");
}

export async function updateWaiver(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const v = parseForm(waiverSchema, formData);
  const { error } = await (supabase as any)
    .from("waivers")
    .update({ name: v.name, body: v.body, active: v.active })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/waivers/${id}`);
}

export async function deleteWaiver(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("waivers").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/waivers");
  redirect("/waivers");
}

// Request a signature: create a pending waiver_signatures row and (optionally) email/SMS the link.
export async function requestWaiverSignature(
  waiverId: string,
  formData: FormData,
) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const customer_id = String(formData.get("customer_id") || "");
  const property_id = String(formData.get("property_id") || "") || null;
  const job_id = String(formData.get("job_id") || "") || null;
  const channel = (String(formData.get("channel") || "email") as "email" | "sms");
  const signer_email = String(formData.get("signer_email") || "").trim() || null;
  const signer_phone = String(formData.get("signer_phone") || "").trim() || null;
  if (!customer_id) throw new Error("Customer required");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customer_id)
    .eq("organization_id", organizationId)
    .single();
  if (!customer) throw new Error("Customer not found");

  const token = crypto.randomUUID().replace(/-/g, "");
  const { data: signature, error } = await (supabase as any)
    .from("waiver_signatures")
    .insert({
      organization_id: organizationId,
      waiver_id: waiverId,
      customer_id,
      property_id,
      job_id,
      token,
      signer_email: signer_email ?? (customer as any).email,
      signer_phone: signer_phone ?? (customer as any).phone ?? (customer as any).mobile_phone,
      status: "pending",
    })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);

  const waiverUrl = `${appUrl()}/waiver/${signature.token}`;
  const result = await sendTemplated({
    supabase: supabase as any,
    organizationId,
    customerId: customer_id,
    kind: "waiver_request",
    channel,
    to: { email: signer_email ?? (customer as any).email, phone: signer_phone ?? (customer as any).phone ?? (customer as any).mobile_phone },
    replyToEmail: organization?.email,
    relatedKind: "waiver",
    relatedId: waiverId,
    vars: {
      org_name: organization?.name ?? "",
      customer_first_name: (customer as any).first_name ?? customerDisplayName(customer as any),
      waiver_url: waiverUrl,
    },
  });
  if (!result.ok) {
    // Surface a warning, but the signature record is still created so the link works manually
    throw new Error(`Signature link created but send failed: ${result.reason}`);
  }
  revalidatePath(`/waivers/${waiverId}`);
}
