import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { EstimatesList, type EstimateRow } from "./estimates-list";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data } = await supabase
    .from("estimates")
    .select("id, estimate_number, status, issue_date, expires_at, total, customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .order("issue_date", { ascending: false });

  if (!data?.length) {
    return (
      <div>
        <PageHeader title="Estimates" description="Quote work to customers." action={{ label: "New estimate", href: "/estimates/new" }} />
        <EmptyState title="No estimates yet" action={{ label: "New estimate", href: "/estimates/new" }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Estimates" description="Quote work to customers." action={{ label: "New estimate", href: "/estimates/new" }} />
      <EstimatesList rows={data as unknown as EstimateRow[]} />
    </div>
  );
}
