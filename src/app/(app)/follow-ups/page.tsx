import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName, formatDate } from "@/lib/utils";
import { createFollowUp, completeFollowUp, reopenFollowUp, deleteFollowUp } from "./actions";

export const dynamic = "force-dynamic";

const KINDS = [
  { value: "general", label: "General" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site visit" },
  { value: "quote_followup", label: "Quote follow-up" },
  { value: "review_request", label: "Review request" },
  { value: "collection", label: "Collection / unpaid" },
];

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { filter } = await searchParams;
  const showCompleted = filter === "completed";

  const [{ data: followUps }, { data: customers }] = await Promise.all([
    (supabase as any)
      .from("follow_ups")
      .select("*, customers(first_name, last_name, company_name)")
      .eq("organization_id", organizationId)
      .eq("completed", showCompleted)
      .order("due_date"),
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("first_name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description="Personal task list — call this customer back, send the estimate, chase the unpaid invoice."
      />

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Add a follow-up</h2>
        <form action={createFollowUp} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-xs sm:col-span-2">
            Customer (optional)
            <select name="customer_id" defaultValue="" className="w-full mt-0.5">
              <option value="">— general —</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Kind
            <select name="kind" defaultValue="general" className="w-full mt-0.5">
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Due
            <input name="due_date" type="date" defaultValue={today} className="w-full mt-0.5" />
          </label>
          <label className="text-xs sm:col-span-4">
            What needs to happen?
            <textarea name="notes" rows={2} className="w-full mt-0.5" placeholder="Call to confirm scope of the bathroom paint estimate." />
          </label>
          <div className="sm:col-span-4 flex justify-end">
            <button type="submit" className="btn-primary text-sm">Add follow-up</button>
          </div>
        </form>
      </section>

      <div className="flex gap-2 mb-3 text-sm">
        <a href="/follow-ups" className={`px-3 py-1.5 rounded-full ${!showCompleted ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`}>Open</a>
        <a href="/follow-ups?filter=completed" className={`px-3 py-1.5 rounded-full ${showCompleted ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`}>Completed</a>
      </div>

      {!followUps?.length ? (
        <EmptyState
          title={showCompleted ? "No completed follow-ups yet" : "All caught up — no open follow-ups"}
          description={showCompleted ? undefined : "Add one above when something needs chasing."}
        />
      ) : (
        <ul className="space-y-2">
          {followUps.map((f: any) => {
            const overdue = !f.completed && f.due_date < today;
            const complete = completeFollowUp.bind(null, f.id);
            const reopen = reopenFollowUp.bind(null, f.id);
            const del = deleteFollowUp.bind(null, f.id);
            return (
              <li
                key={f.id}
                className={`card-padded flex flex-wrap items-start gap-3 ${overdue ? "border-red-200 bg-red-50" : ""}`}
              >
                <form action={f.completed ? reopen : complete} className="pt-0.5">
                  <button type="submit" aria-label={f.completed ? "Reopen" : "Mark complete"} className="w-5 h-5 rounded border border-gray-300 grid place-items-center bg-white">
                    {f.completed && <span className="text-brand-600 text-sm leading-none">✓</span>}
                  </button>
                </form>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    <span className="capitalize text-gray-500 text-xs mr-1">{f.kind.replace("_", " ")}:</span>
                    {f.notes || "(no notes)"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {f.customers ? customerDisplayName(f.customers) + " · " : ""}due {formatDate(f.due_date)}
                    {overdue && <span className="ml-1 text-red-600 font-medium">overdue</span>}
                  </p>
                </div>
                <form action={del}>
                  <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
