import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { deleteEquipment } from "./actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data } = await supabase.from("equipment").select("*").eq("organization_id", organizationId).order("name");

  if (!data?.length) {
    return (
      <div>
        <PageHeader title="Equipment" description="Pumps, surface cleaners, trailers, vehicles." action={{ label: "Add equipment", href: "/equipment/new" }} />
        <EmptyState title="No equipment yet" action={{ label: "Add equipment", href: "/equipment/new" }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Equipment" description="Pumps, surface cleaners, trailers, vehicles." action={{ label: "Add equipment", href: "/equipment/new" }} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {data.map((e) => {
          const del = deleteEquipment.bind(null, e.id);
          return (
            <div key={e.id} className="card-padded">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{e.name}</h3>
                  {e.type && <p className="text-xs text-gray-500">{e.type}</p>}
                </div>
                <span className={`badge ${e.status === "active" ? "bg-green-100 text-green-700" : e.status === "maintenance" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{e.status}</span>
              </div>
              {e.serial_number && <p className="text-xs text-gray-500 mt-1">SN: {e.serial_number}</p>}
              {e.purchase_price && <p className="text-sm mt-2">Purchased {formatCurrency(Number(e.purchase_price))} on {formatDate(e.purchase_date)}</p>}
              {e.next_service_date && <p className="text-xs text-amber-700 mt-1">Next service: {formatDate(e.next_service_date)}</p>}
              {Number(e.hours_used) > 0 && <p className="text-xs text-gray-500">{e.hours_used} hours</p>}
              <form action={del} className="mt-3"><button className="text-xs text-red-600 hover:underline">Delete</button></form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
