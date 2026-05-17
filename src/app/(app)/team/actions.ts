"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { BRAND } from "@/lib/brand";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";

export async function inviteMember(formData: FormData) {
  const { supabase, organizationId, organization, user } = await getSessionAndOrg();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member");
  if (!email) throw new Error("Email is required");
  if (!["admin", "member", "viewer"].includes(role)) throw new Error("Invalid role");

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("seats_allowed")
    .eq("slug", (organization as any)?.subscription_plan ?? "starter")
    .maybeSingle();
  if (!plan?.seats_allowed) {
    throw new Error("Team seats require the Plus or Pro plan. Upgrade in Billing.");
  }

  // Don't re-invite if there's already a pending invite for this email
  const { data: existing } = await supabase
    .from("organization_invites")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) throw new Error("An invite is already pending for that email.");

  const token = randomBytes(32).toString("hex");
  const { data: invite } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: organizationId,
      email,
      role,
      token,
      invited_by: user.id,
    })
    .select("id")
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptUrl = `${appUrl}/invite/${token}`;
  await sendEmail({
    to: email,
    subject: `You're invited to join ${organization?.name} on ${BRAND.name}`,
    html: `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
      <div style="max-width:480px;margin:0 auto;background:#fff;padding:28px;border-radius:12px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px;">You've been invited</h2>
        <p>${(user.email ?? "Your team")} added you to <strong>${organization?.name}</strong> on ${BRAND.name}.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">Accept invite →</a>
        </p>
        <p style="color:#64748b;font-size:12px;">Link expires in 14 days.</p>
      </div>
    </body></html>`,
    replyTo: organization?.email ?? undefined,
  });

  await logAudit({
    organizationId,
    action: "create",
    entityType: "invite",
    entityId: invite?.id ?? null,
    entityLabel: email,
    after: { email, role },
  });

  revalidatePath("/team");
}

export async function revokeInvite(inviteId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("organization_id", organizationId);
  await logAudit({
    organizationId,
    action: "delete",
    entityType: "invite",
    entityId: inviteId,
  });
  revalidatePath("/team");
}

export async function removeMember(userId: string) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  // Remove from org_members; cascades NOT applied to user (the user still exists,
  // they're just no longer in this org).
  await supabase
    .from("organization_members")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  // Update Stripe subscription seat quantity
  await syncStripeSeatQuantity(supabase as any, organizationId, organization);

  await logAudit({
    organizationId,
    action: "delete",
    entityType: "team_member",
    entityId: userId,
  });
  revalidatePath("/team");
}

// Recomputes the current seat count (members - 1 base) and updates the
// Stripe subscription's add-on seat line item quantity.
export async function syncStripeSeatQuantity(supabase: any, organizationId: string, organization: any) {
  const stripe = getStripe();
  const subId = organization?.subscription_stripe_id;
  if (!stripe || !subId) return;

  const { count } = await supabase
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  const additionalSeats = Math.max(0, (count ?? 1) - 1);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("addon_seat_stripe_price_id")
    .eq("slug", organization?.subscription_plan ?? "starter")
    .maybeSingle();

  const seatPriceId = plan?.addon_seat_stripe_price_id;
  if (!seatPriceId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  const existingItem = sub.items.data.find((i: any) => i.price?.id === seatPriceId);

  if (additionalSeats === 0) {
    // Remove the seat item entirely if we don't need it
    if (existingItem) {
      await stripe.subscriptionItems.del(existingItem.id, { proration_behavior: "create_prorations" });
      await supabase.from("organizations").update({ seats_stripe_item_id: null, additional_seats: 0 }).eq("id", organizationId);
    }
    return;
  }

  if (existingItem) {
    await stripe.subscriptionItems.update(existingItem.id, { quantity: additionalSeats, proration_behavior: "create_prorations" });
  } else {
    const created = await stripe.subscriptionItems.create({
      subscription: subId,
      price: seatPriceId,
      quantity: additionalSeats,
      proration_behavior: "create_prorations",
    });
    await supabase.from("organizations").update({ seats_stripe_item_id: created.id }).eq("id", organizationId);
  }
  await supabase.from("organizations").update({ additional_seats: additionalSeats }).eq("id", organizationId);
}
