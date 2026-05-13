import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { q } = await searchParams;

  let query = supabase
    .from("properties")
    .select("id, address_line1, address_line2, city, state, postal_code, nickname, gate_code, square_footage, stories, notes, customers(id, first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .order("address_line1");
  if (q) query = query.or(`address_line1.ilike.%${q}%,city.ilike.%${q}%,nickname.ilike.%${q}%`);

  const { data } = await query;

  return (
    <div>
      <PageHeader title="Properties" description="Every job site you service across all customers." />

      <form className="mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search address, city, or nickname"
          className="w-full sm:max-w-md"
        />
      </form>

      {!data?.length ? (
        <EmptyState
          title={q ? "No properties match" : "No properties yet"}
          description="Properties are added from each customer's detail page."
        />
      ) : (
        <div className="table-wrap overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Customer</th>
                <th className="hidden sm:table-cell">City / State</th>
                <th className="hidden sm:table-cell text-right">Sq ft</th>
                <th className="hidden sm:table-cell text-right">Stories</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p: any) => {
                const cust = p.customers;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.address_line1}</div>
                      {(p.nickname || p.address_line2) && (
                        <div className="text-xs text-gray-500">
                          {[p.nickname, p.address_line2].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td>
                      {cust ? (
                        <Link href={`/customers/${cust.id}`} className="hover:text-brand-700">
                          {customerDisplayName(cust)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden sm:table-cell text-gray-500">
                      {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="hidden sm:table-cell text-right text-gray-600">
                      {p.square_footage ? p.square_footage.toLocaleString() : "—"}
                    </td>
                    <td className="hidden sm:table-cell text-right text-gray-600">{p.stories ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
