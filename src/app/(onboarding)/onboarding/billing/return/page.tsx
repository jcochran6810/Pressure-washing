import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { setOnboardingStep } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

// Stripe Checkout redirects here on success. We don't need to validate the
// session — the webhook (already wired in src/app/api/stripe/webhook) is
// the source of truth for subscription state. We just advance the wizard.
export default async function BillingReturn({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const ctx = await loadWizardContext("billing");
  const params = await searchParams;
  if (!params?.session_id) redirect("/onboarding/billing?missing_session=1");
  await setOnboardingStep(ctx.organizationId, "messaging");
  redirect("/onboarding/messaging?billing=ok");
}
