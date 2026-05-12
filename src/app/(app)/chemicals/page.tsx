import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { recordChemicalTransaction, deleteChemical } from "./actions";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ChemicalsPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: chemicals } = await supabase
    .from("chemicals")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");

  if (!chemicals?.length) {
    return (
      <div>
        <PageHeader title="Chemicals" description="Inventory, SDS sheets, reorder alerts." action={{ label: "Add chemical", href: "/chemicals/new" }} />
        <EmptyState
          title="No chemicals yet"
          description="Track SH, surfactants, degreasers, and reorder levels."
          action={{ label: "Add chemical", href: "/chemicals/new" }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Chemicals" description="Inventory, SDS sheets, reorder alerts." action={{ label: "Add chemical", href: "/chemicals/new" }} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {chemicals.map((c) => {
          const low = Number(c.current_stock ?? 0) <= Number(c.reorder_level ?? 0);
          const delThis = deleteChemical.bind(null, c.id);
          return (
            <div key={c.id} className={`card-padded ${low ? "border-amber-400 ring-1 ring-amber-200" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.brand && <p className="text-xs text-gray-500">{c.brand}</p>}
                </div>
                {low && <span className="badge bg-amber-100 text-amber-700">Low</span>}
              </div>
              <p className="mt-2 text-2xl font-bold">
                {Number(c.current_stock ?? 0).toLocaleString()} <span className="text-sm font-normal text-gray-500">{c.unit}</span>
              </p>
              <p className="text-xs text-gray-500">Reorder at {Number(c.reorder_level ?? 0)} {c.unit}</p>
              {c.cost_per_unit && <p className="text-xs text-gray-500 mt-1">{formatCurrency(Number(c.cost_per_unit))} / {c.unit}</p>}
              {c.supplier && <p className="text-xs text-gray-500">Supplier: {c.supplier}</p>}
              {c.sds_url && <a href={c.sds_url} target="_blank" rel="noopener" className="text-xs text-brand-600 hover:underline">SDS sheet ↗</a>}

              <details className="mt-3">
                <summary className="text-xs text-brand-600 cursor-pointer">+ Adjust stock</summary>
                <form action={recordChemicalTransaction} className="mt-2 space-y-1.5">
                  <input type="hidden" name="chemical_id" value={c.id} />
                  <select name="transaction_type" className="w-full text-xs">
                    <option value="purchase">+ Purchase</option>
                    <option value="usage">− Usage</option>
                    <option value="waste">− Waste</option>
                    <option value="adjustment">= Adjustment (set total)</option>
                  </select>
                  <input name="quantity" type="number" step="0.01" min="0" placeholder="Quantity" required className="w-full text-xs" />
                  <input name="cost" type="number" step="0.01" min="0" placeholder="Cost (purchases)" className="w-full text-xs" />
                  <input name="notes" placeholder="Notes" className="w-full text-xs" />
                  <button className="btn-primary w-full text-xs">Record</button>
                </form>
              </details>
              <form action={delThis} className="mt-2"><button className="text-xs text-red-600 hover:underline">Delete</button></form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
