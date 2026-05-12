import { AppShell } from "@/components/app-shell";
import { getSessionAndOrg } from "@/lib/org";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, organization } = await getSessionAndOrg();
  return (
    <AppShell orgName={organization?.name ?? "Your Business"} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
