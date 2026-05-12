import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { deleteCampaign } from "./actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: campaigns } = await supabase.from("campaigns").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });

  if (!campaigns?.length) {
    return (
      <div>
        <PageHeader title="Marketing campaigns" description="Track spend and leads from Google, Facebook, door hangers, yard signs." action={{ label: "New campaign", href: "/campaigns/new" }} />
        <EmptyState title="No campaigns yet" action={{ label: "New campaign", href: "/campaigns/new" }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Marketing campaigns" description="Track spend and leads from Google, Facebook, door hangers, yard signs." action={{ label: "New campaign", href: "/campaigns/new" }} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {campaigns.map((c) => {
          const remaining = Number(c.budget ?? 0) - Number(c.spent ?? 0);
          const pct = c.budget ? Math.min(100, Math.round((Number(c.spent ?? 0) / Number(c.budget)) * 100)) : 0;
          const del = deleteCampaign.bind(null, c.id);
          return (
            <div key={c.id} className="card-padded">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.channel && <p className="text-xs text-gray-500">{c.channel}</p>}
                </div>
                <span className={`badge ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.status}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(c.start_date)} → {formatDate(c.end_date)}
              </p>
              {c.budget && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Spent</span>
                    <span>{formatCurrency(Number(c.spent))} / {formatCurrency(Number(c.budget))}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${pct >= 100 ? "bg-red-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Remaining {formatCurrency(Math.max(0, remaining))}</p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">{c.leads_generated ?? 0} leads</p>
              <form action={del} className="mt-2"><button className="text-xs text-red-600 hover:underline">Delete</button></form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
