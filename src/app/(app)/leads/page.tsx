import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { setLeadStatus, convertLead, deleteLead } from "./actions";
import { formatCurrency, formatDate, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: leads } = await supabase
    .from("leads")
    .select("*, lead_sources(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (!leads?.length) {
    return (
      <div>
        <PageHeader title="Leads" description="Pipeline from first contact to won." action={{ label: "New lead", href: "/leads/new" }} />
        <EmptyState title="No leads yet" action={{ label: "New lead", href: "/leads/new" }} />
      </div>
    );
  }

  const byStatus = ["new", "contacted", "quoted", "won", "lost", "nurture"] as const;
  const grouped = byStatus.map((s) => ({ status: s, items: leads.filter((l) => l.status === s) }));

  return (
    <div>
      <PageHeader title="Leads" description="Pipeline from first contact to won." action={{ label: "New lead", href: "/leads/new" }} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {grouped.map((g) => (
          <div key={g.status} className="card-padded text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500">{g.status}</p>
            <p className="text-2xl font-bold">{g.items.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(g.items.reduce((s, i) => s + Number(i.estimated_value ?? 0), 0))}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {leads.map((l: any) => {
          const advanceMap: Record<string, string> = { new: "contacted", contacted: "quoted", quoted: "won" };
          const next = advanceMap[l.status];
          const advance = next ? setLeadStatus.bind(null, l.id, next) : null;
          const lose = setLeadStatus.bind(null, l.id, "lost");
          const conv = convertLead.bind(null, l.id);
          const del = deleteLead.bind(null, l.id);
          return (
            <div key={l.id} className="card-padded flex flex-wrap gap-3 items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{[l.first_name, l.last_name].filter(Boolean).join(" ") || "Anonymous"}</h3>
                <p className="text-sm text-gray-600">{l.phone || l.email || "—"}</p>
                {l.address && <p className="text-xs text-gray-500">{l.address}</p>}
                {l.lead_sources?.name && <p className="text-xs text-gray-500">Source: {l.lead_sources.name}</p>}
                <p className="text-xs text-gray-400 mt-1">Added {formatDate(l.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`badge ${statusColor(l.status)}`}>{l.status}</span>
                {l.estimated_value && <span className="text-sm font-medium">{formatCurrency(Number(l.estimated_value))}</span>}
                <div className="flex gap-2 flex-wrap">
                  {advance && <form action={advance}><button className="btn-secondary text-xs py-1 px-2">→ {next}</button></form>}
                  {l.status !== "won" && <form action={conv}><button className="btn-primary text-xs py-1 px-2">Convert</button></form>}
                  {l.status !== "lost" && l.status !== "won" && <form action={lose}><button className="btn-ghost text-xs py-1 px-2 text-red-600">Lost</button></form>}
                  <form action={del}><button className="text-xs text-red-500">✕</button></form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
