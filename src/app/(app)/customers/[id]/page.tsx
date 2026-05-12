import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { addProperty, deleteCustomer } from "../actions";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const [{ data: properties }, { data: estimates }, { data: jobs }, { data: invoices }] = await Promise.all([
    supabase.from("properties").select("*").eq("customer_id", id),
    supabase.from("estimates").select("id, estimate_number, status, total, issue_date").eq("customer_id", id).order("issue_date", { ascending: false }),
    supabase.from("jobs").select("id, title, status, scheduled_start").eq("customer_id", id).order("scheduled_start", { ascending: false }),
    supabase.from("invoices").select("id, invoice_number, status, total, balance_due, due_date").eq("customer_id", id).order("issue_date", { ascending: false }),
  ]);

  const deleteThis = deleteCustomer.bind(null, id);
  const addProp = addProperty.bind(null, id);

  return (
    <div>
      <Link href="/customers" className="text-sm text-brand-600 hover:underline">← Customers</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{customerDisplayName(customer)}</h1>
          <p className="text-sm text-gray-600 capitalize">{customer.customer_type} customer</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/estimates/new?customer=${customer.id}`} className="btn-secondary">+ Estimate</Link>
          <Link href={`/jobs/new?customer=${customer.id}`} className="btn-secondary">+ Job</Link>
          <Link href={`/invoices/new?customer=${customer.id}`} className="btn-primary">+ Invoice</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card-padded">
          <h2 className="font-semibold mb-3">Contact</h2>
          <dl className="text-sm space-y-2">
            <Row label="Email" value={customer.email} link={customer.email ? `mailto:${customer.email}` : undefined} />
            <Row label="Phone" value={customer.phone} link={customer.phone ? `tel:${customer.phone}` : undefined} />
            <Row label="Mobile" value={customer.mobile_phone} link={customer.mobile_phone ? `tel:${customer.mobile_phone}` : undefined} />
            <Row label="Lead source" value={customer.lead_source} />
            <Row label="Added" value={formatDate(customer.created_at)} />
          </dl>
          {customer.notes && (
            <>
              <h3 className="text-sm font-semibold mt-4">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
            </>
          )}
          <form action={deleteThis} className="mt-5">
            <button type="submit" className="btn-ghost text-red-600 hover:bg-red-50 text-xs">Delete customer</button>
          </form>
        </div>

        <div className="card-padded lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Properties</h2>
          </div>
          {!properties?.length ? (
            <p className="text-sm text-gray-500">No properties yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {properties.map((p) => (
                <li key={p.id} className="py-2 text-sm flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.nickname || p.address_line1}</p>
                    <p className="text-gray-600">{p.address_line1}{p.address_line2 ? `, ${p.address_line2}` : ""}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""} {p.postal_code || ""}</p>
                    {p.gate_code && <p className="text-xs text-gray-500">Gate code: {p.gate_code}</p>}
                  </div>
                  <Link href={`/measure?property=${p.id}`} className="btn-secondary text-xs">Measure on map</Link>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3">
            <summary className="text-sm text-brand-600 cursor-pointer">+ Add property</summary>
            <form action={addProp} className="space-y-2 mt-3">
              <input name="nickname" placeholder="Nickname (optional)" className="w-full" />
              <input name="address_line1" placeholder="Address" required className="w-full" />
              <input name="address_line2" placeholder="Address line 2" className="w-full" />
              <div className="grid grid-cols-3 gap-2">
                <input name="city" placeholder="City" className="w-full" />
                <input name="state" placeholder="State" className="w-full" />
                <input name="postal_code" placeholder="Zip" className="w-full" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input name="square_footage" type="number" placeholder="Sq ft" className="w-full" />
                <input name="stories" type="number" placeholder="Stories" className="w-full" />
                <input name="gate_code" placeholder="Gate code" className="w-full" />
              </div>
              <button type="submit" className="btn-primary text-sm">Add property</button>
            </form>
          </details>
        </div>
      </div>

      <RelatedSection title="Estimates" emptyMsg="No estimates." href="/estimates">
        {estimates?.map((e: any) => (
          <li key={e.id} className="py-2 flex justify-between items-center text-sm">
            <span className="font-medium">{e.estimate_number}</span>
            <span className="text-gray-500">{formatDate(e.issue_date)}</span>
            <span className={`badge ${statusColor(e.status)}`}>{e.status}</span>
            <span className="font-medium">{formatCurrency(Number(e.total))}</span>
          </li>
        ))}
      </RelatedSection>

      <RelatedSection title="Jobs" emptyMsg="No jobs scheduled." href="/jobs">
        {jobs?.map((j: any) => (
          <li key={j.id} className="py-2 flex justify-between items-center text-sm">
            <span className="font-medium">{j.title}</span>
            <span className="text-gray-500">{formatDate(j.scheduled_start)}</span>
            <span className={`badge ${statusColor(j.status)}`}>{j.status}</span>
          </li>
        ))}
      </RelatedSection>

      <RelatedSection title="Invoices" emptyMsg="No invoices." href="/invoices">
        {invoices?.map((i: any) => (
          <li key={i.id} className="py-2 flex justify-between items-center text-sm">
            <Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand-700">{i.invoice_number}</Link>
            <span className="text-gray-500">{formatDate(i.due_date)}</span>
            <span className={`badge ${statusColor(i.status)}`}>{i.status}</span>
            <span className="font-medium">{formatCurrency(Number(i.balance_due))}</span>
          </li>
        ))}
      </RelatedSection>
    </div>
  );
}

function Row({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900 truncate">
        {value ? (link ? <a href={link} className="text-brand-700 hover:underline">{value}</a> : value) : "—"}
      </dd>
    </div>
  );
}

function RelatedSection({ title, href, emptyMsg, children }: { title: string; href: string; emptyMsg: string; children?: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="card mt-5">
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-brand-600 hover:underline">View all</Link>
      </header>
      <div className="px-4">
        {hasChildren ? <ul className="divide-y divide-gray-100">{children}</ul> : <p className="py-4 text-sm text-gray-500">{emptyMsg}</p>}
      </div>
    </section>
  );
}
