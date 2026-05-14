import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName, formatCurrency, formatDate } from "@/lib/utils";
import { RECURRENCE_KINDS } from "@/lib/recurring";
import { createRecurring, updateRecurring, deleteRecurring, materialiseRecurring } from "./actions";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const [{ data: recurring }, { data: customers }, { data: services }] = await Promise.all([
    (supabase as any)
      .from("recurring_jobs")
      .select("*, customers(first_name, last_name, company_name), properties(address_line1, city)")
      .eq("organization_id", organizationId)
      .order("active", { ascending: false })
      .order("next_service_date"),
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("first_name"),
    supabase.from("services").select("id, name").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const dueNow = (recurring ?? []).filter((r: any) => r.active && (r.next_service_date ?? "") <= today);

  return (
    <div>
      <PageHeader
        title="Recurring jobs"
        description="Mowing routes, weekly cleans, monthly pool service. The schedule rolls forward automatically."
      />

      {dueNow.length > 0 && (
        <section className="card-padded mb-5 border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-900">
            {dueNow.length} recurring job{dueNow.length === 1 ? "" : "s"} due
          </h2>
          <p className="text-xs text-amber-800 mt-1 mb-3">
            Tap "Spawn job" to drop a one-time job into the schedule and roll the next service date forward.
          </p>
          <ul className="space-y-2">
            {dueNow.map((r: any) => {
              const spawn = materialiseRecurring.bind(null, r.id);
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded-md p-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {customerDisplayName(r.customers ?? {})} · due {formatDate(r.next_service_date)}
                    </p>
                  </div>
                  <form action={spawn}>
                    <button type="submit" className="btn-primary text-xs whitespace-nowrap">Spawn job</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card-padded mb-6">
        <h2 className="font-semibold mb-3">Add recurring job</h2>
        <form action={createRecurring} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs">
            Title
            <input name="title" required placeholder="Weekly mow" className="w-full mt-0.5" />
          </label>
          <label className="text-xs">
            Customer
            <select name="customer_id" required className="w-full mt-0.5">
              <option value="">— pick —</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Service (optional)
            <select name="service_id" defaultValue="" className="w-full mt-0.5">
              <option value="">—</option>
              {services?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Default price
            <input name="default_price" type="number" step="0.01" defaultValue="0" className="w-full mt-0.5" />
          </label>
          <label className="text-xs">
            Recurrence
            <select name="recurrence_kind" defaultValue="weekly" className="w-full mt-0.5">
              {RECURRENCE_KINDS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Interval (custom days only)
            <input name="recurrence_interval" type="number" defaultValue="1" min="1" className="w-full mt-0.5" />
          </label>
          <label className="text-xs">
            Next service date
            <input name="next_service_date" type="date" defaultValue={today} required className="w-full mt-0.5" />
          </label>
          <label className="text-xs">
            Duration (min)
            <input name="duration_minutes" type="number" defaultValue="60" min="0" className="w-full mt-0.5" />
          </label>
          <label className="text-xs sm:col-span-2">
            Notes
            <textarea name="notes" rows={2} className="w-full mt-0.5" />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary text-sm">Add recurring job</button>
          </div>
        </form>
      </section>

      {!recurring?.length ? (
        <EmptyState title="No recurring jobs yet" description="Add one above to start building your repeat-service book." />
      ) : (
        <div className="space-y-3">
          {recurring.map((r: any) => {
            const update = updateRecurring.bind(null, r.id);
            const del = deleteRecurring.bind(null, r.id);
            const spawn = materialiseRecurring.bind(null, r.id);
            return (
              <div key={r.id} className="card-padded">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.title}</p>
                    <p className="text-xs text-gray-500">
                      {customerDisplayName(r.customers ?? {})} · {RECURRENCE_KINDS.find((k) => k.value === r.recurrence_kind)?.label ?? r.recurrence_kind}
                      {r.last_service_date && ` · last ${formatDate(r.last_service_date)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-gray-100 text-gray-700">
                      {formatCurrency(Number(r.default_price ?? 0))}
                    </span>
                    {r.active === false && <span className="badge bg-gray-200 text-gray-700">Inactive</span>}
                    <form action={spawn}>
                      <button type="submit" className="btn-secondary text-xs">Spawn now</button>
                    </form>
                    <form action={del}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
                    </form>
                  </div>
                </div>
                <form action={update} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="text-xs">
                    Title
                    <input name="title" defaultValue={r.title} required className="w-full mt-0.5" />
                  </label>
                  <label className="text-xs">
                    Recurrence
                    <select name="recurrence_kind" defaultValue={r.recurrence_kind} className="w-full mt-0.5">
                      {RECURRENCE_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    Interval
                    <input name="recurrence_interval" type="number" defaultValue={r.recurrence_interval ?? 1} min="1" className="w-full mt-0.5" />
                  </label>
                  <label className="text-xs">
                    Next service date
                    <input name="next_service_date" type="date" defaultValue={r.next_service_date} className="w-full mt-0.5" />
                  </label>
                  <label className="text-xs">
                    Default price
                    <input name="default_price" type="number" step="0.01" defaultValue={r.default_price ?? 0} className="w-full mt-0.5" />
                  </label>
                  <label className="text-xs">
                    Duration (min)
                    <input name="duration_minutes" type="number" defaultValue={r.duration_minutes ?? 60} min="0" className="w-full mt-0.5" />
                  </label>
                  <label className="text-xs sm:col-span-3">
                    Notes
                    <textarea name="notes" rows={2} defaultValue={r.notes ?? ""} className="w-full mt-0.5" />
                  </label>
                  <label className="text-xs flex items-center gap-2">
                    <input type="checkbox" name="active" defaultChecked={r.active !== false} /> Active
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button type="submit" className="btn-secondary text-sm">Save</button>
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-6">
        Tip: the cron at <code className="bg-gray-100 px-1 rounded text-[11px]">/api/cron/recurring</code> will materialise due jobs automatically once you wire your scheduler to it. Until then, use Spawn now to drop the next visit on the calendar.
      </p>
    </div>
  );
}
