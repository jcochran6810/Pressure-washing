import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { q } = await searchParams;

  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, email, phone, customer_type, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: customers } = await query;

  return (
    <div>
      <PageHeader title="Customers" description="Your residential and commercial accounts." action={{ label: "New customer", href: "/customers/new" }} />

      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, phone…"
          className="w-full sm:max-w-sm"
        />
      </form>

      {!customers?.length ? (
        <EmptyState title="No customers yet" description="Add your first customer to start sending estimates and invoices." action={{ label: "New customer", href: "/customers/new" }} />
      ) : (
        <div className="table-wrap overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="hidden sm:table-cell">Email</th>
                <th className="hidden sm:table-cell">Phone</th>
                <th className="hidden md:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="cursor-pointer">
                  <td>
                    <Link href={`/customers/${c.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                      {customerDisplayName(c)}
                    </Link>
                  </td>
                  <td className="capitalize">{c.customer_type}</td>
                  <td className="hidden sm:table-cell text-gray-600">{c.email || "—"}</td>
                  <td className="hidden sm:table-cell text-gray-600">{c.phone || "—"}</td>
                  <td className="hidden md:table-cell text-gray-500">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
