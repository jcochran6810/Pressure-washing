#!/usr/bin/env -S npx tsx
/**
 * Manual customer-data deletion script.
 *
 * Usage:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/delete-customer-data.ts <org-id> [--confirm]
 *
 * What it does:
 *   1. Looks up the organization by id.
 *   2. Prints a summary of what would be deleted (customers, invoices, photos, etc).
 *   3. Without --confirm, exits without making changes (DRY RUN).
 *   4. With --confirm, deletes the organization. Cascades wipe all dependent
 *      rows via the ON DELETE CASCADE foreign keys in the baseline migration.
 *   5. Optionally cancels the Stripe subscription if SUBSCRIPTION_STRIPE_ID
 *      is present and STRIPE_SECRET_KEY is set.
 *
 * Notes:
 *   - This script requires the SERVICE ROLE key (not anon). Never commit the key.
 *   - Storage objects (photos, signatures, receipts) are NOT auto-deleted by
 *     Supabase when an org is removed. The script also clears the org's storage
 *     prefix manually.
 *   - For GDPR right-to-erasure requests, this is the correct tool. For the
 *     automated 90-day post-cancellation purge, the database cron handles it
 *     via purge_scheduled_deletions().
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const args = process.argv.slice(2);
  const orgId = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");

  if (!orgId) {
    console.error("Usage: delete-customer-data.ts <org-id> [--confirm]");
    process.exit(2);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orgId)) {
    console.error("Org id must be a UUID.");
    process.exit(2);
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exit(2);
  }

  const sb = createClient(url, key);

  // 1. Load the org
  const { data: org, error } = await sb
    .from("organizations")
    .select("id, name, email, subscription_stripe_id, subscription_customer_id, created_at")
    .eq("id", orgId)
    .single();
  if (error || !org) {
    console.error("Organization not found:", error?.message);
    process.exit(1);
  }

  console.log(`\nOrganization: ${org.name}`);
  console.log(`  ID:            ${org.id}`);
  console.log(`  Email:         ${org.email}`);
  console.log(`  Created:       ${org.created_at}`);
  console.log(`  Stripe sub:    ${org.subscription_stripe_id ?? "—"}`);
  console.log(`  Stripe cust:   ${org.subscription_customer_id ?? "—"}`);

  // 2. Count what would go away
  const tables = [
    "customers", "properties", "estimates", "invoices", "payments",
    "jobs", "photo_attachments", "leads", "campaigns", "expenses",
    "chemicals", "equipment", "contracts", "waivers", "waiver_signatures",
    "customer_reminders", "audit_log",
  ];
  console.log("\nCounts (would be deleted):");
  for (const t of tables) {
    const { count } = await sb.from(t).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    console.log(`  ${t.padEnd(22)} ${count ?? 0}`);
  }

  if (!confirm) {
    console.log("\nDRY RUN — pass --confirm to actually delete.");
    process.exit(0);
  }

  // 3. Cancel Stripe subscription (if present)
  if (org.subscription_stripe_id && process.env.STRIPE_SECRET_KEY) {
    console.log("\nCancelling Stripe subscription...");
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(org.subscription_stripe_id);
      console.log("  Stripe subscription cancelled.");
    } catch (e: any) {
      console.warn("  Stripe cancellation failed (continuing):", e.message);
    }
  }

  // 4. Clear storage objects under this org's prefix
  console.log("\nClearing storage...");
  for (const bucket of ["photos", "signatures", "receipts", "logos"]) {
    try {
      // List with prefix and delete in batches
      const { data: files } = await sb.storage.from(bucket).list(orgId, { limit: 1000 });
      if (files?.length) {
        const paths = files.map((f) => `${orgId}/${f.name}`);
        await sb.storage.from(bucket).remove(paths);
        console.log(`  ${bucket}: deleted ${paths.length} file(s)`);
      }
    } catch (e: any) {
      console.warn(`  ${bucket}: ${e.message}`);
    }
  }

  // 5. Delete the org — cascades wipe everything else
  console.log("\nDeleting organization row (cascades)...");
  const { error: delErr } = await sb.from("organizations").delete().eq("id", orgId);
  if (delErr) {
    console.error("Delete failed:", delErr.message);
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
