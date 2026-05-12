import { AppShell } from "@/components/app-shell";
import { getSessionAndOrg } from "@/lib/org";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, organizationId, organization } = await getSessionAndOrg();

  const [{ count: jobsCount }, { count: invoicesCount }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["scheduled", "in_progress"]),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["sent", "partial", "overdue"]),
  ]);

  return (
    <AppShell
      orgName={organization?.name ?? "Your Business"}
      userEmail={user.email ?? "Demo user"}
      isDemo={!!organization?.is_demo}
      badges={{ "/jobs": jobsCount ?? 0, "/invoices": invoicesCount ?? 0 }}
    >
      {children}
    </AppShell>
  );
}
