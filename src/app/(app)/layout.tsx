import { AppShell } from "@/components/app-shell";
import { ToastFromSearchParams, ToastProvider } from "@/components/toast";
import { getSessionAndOrg } from "@/lib/org";
import type { Notification } from "@/components/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, organizationId, organization } = await getSessionAndOrg();

  const followUpCutoff = new Date();
  followUpCutoff.setDate(followUpCutoff.getDate() - 3);
  const serviceCutoff = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [
    { count: jobsCount },
    { count: invoicesCount },
    { count: overdueCount },
    { data: openInvoices },
    { data: followUpEstimates },
    { count: newLeadsCount },
    { data: lowStock },
    { data: serviceDue },
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["scheduled", "in_progress"]),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "overdue"),
    supabase.from("invoices").select("balance_due").eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]),
    supabase.from("estimates").select("id").eq("organization_id", organizationId).eq("status", "sent").lte("sent_at", followUpCutoff.toISOString()),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "new"),
    supabase.from("chemicals").select("id, name, current_stock, reorder_level").eq("organization_id", organizationId),
    supabase.from("equipment").select("id, name, next_service_date").eq("organization_id", organizationId).not("next_service_date", "is", null).lte("next_service_date", serviceCutoff),
  ]);

  const outstanding = (openInvoices ?? []).reduce((s, i: any) => s + Number(i.balance_due ?? 0), 0);
  const lowStockItems = (lowStock ?? []).filter((c: any) => (c.current_stock ?? 0) <= (c.reorder_level ?? 0));
  const followUpCount = followUpEstimates?.length ?? 0;
  const serviceDueCount = serviceDue?.length ?? 0;
  const currency = organization?.currency ?? "USD";

  const notifications: Notification[] = [];
  if ((overdueCount ?? 0) > 0) {
    notifications.push({
      id: "overdue",
      tone: "alert",
      title: `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`,
      detail: outstanding > 0 ? formatMoney(outstanding, currency) + " outstanding" : undefined,
      href: "/invoices?status=overdue",
    });
  }
  if (followUpCount > 0) {
    notifications.push({
      id: "follow_up",
      tone: "warning",
      title: `${followUpCount} estimate${followUpCount === 1 ? "" : "s"} need follow-up`,
      detail: "Sent 3+ days ago, no response",
      href: "/estimates",
    });
  }
  if ((newLeadsCount ?? 0) > 0) {
    notifications.push({
      id: "leads",
      tone: "info",
      title: `${newLeadsCount} new lead${newLeadsCount === 1 ? "" : "s"}`,
      detail: "Reach out before they go cold",
      href: "/leads",
    });
  }
  if (lowStockItems.length > 0) {
    notifications.push({
      id: "low_stock",
      tone: "warning",
      title: `${lowStockItems.length} chemical${lowStockItems.length === 1 ? "" : "s"} low on stock`,
      detail: lowStockItems
        .slice(0, 2)
        .map((c: any) => c.name)
        .join(", ") + (lowStockItems.length > 2 ? ` +${lowStockItems.length - 2} more` : ""),
      href: "/chemicals",
    });
  }
  if (serviceDueCount > 0) {
    notifications.push({
      id: "service_due",
      tone: "warning",
      title: `${serviceDueCount} piece${serviceDueCount === 1 ? "" : "s"} of equipment due for service`,
      detail: "Within the next 2 weeks",
      href: "/equipment",
    });
  }

  return (
    <ToastProvider>
      <ToastFromSearchParams />
      <AppShell
        orgName={organization?.name ?? "Your Business"}
        userEmail={user.email ?? "Demo user"}
        isDemo={!!organization?.is_demo}
        badges={{ "/jobs": jobsCount ?? 0, "/invoices": invoicesCount ?? 0 }}
        notifications={notifications}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}

function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}
