import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  startImpersonation,
  setOrgDisabled,
  adjustSubscription,
  grantCompedAccess,
  removeCompedAccess,
} from "../../actions";
import { resolveOrgAccess, accessLabel } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminCompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const [
    { data: members },
    { count: customerCount },
    { count: jobCount },
    { count: invoiceCount },
    { data: recentPayments },
    { data: recentInvoices },
    { data: actions },
  ] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, created_at").eq("organization_id", id),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("organization_id", id),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("organization_id", id),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", id),
    supabase.from("payments").select("amount, payment_date, payment_method").eq("organization_id", id).order("payment_date", { ascending: false }).limit(10),
    supabase.from("invoices").select("invoice_number, status, total, balance_due, due_date").eq("organization_id", id).in("status", ["sent", "partial", "overdue"]).order("due_date").limit(10),
    supabase.from("admin_actions").select("action, payload, created_at, admin_user_id").eq("target_kind", "organization").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  const lifetime = (recentPayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const trialMsLeft = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() - Date.now() : 0;
  const trialDaysLeft = Math.ceil(trialMsLeft / 86400000);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/companies" className="text-xs text-gray-500 hover:underline">← All companies</Link>
          <h1 className="text-2xl font-bold mt-1">
            {org.name}
            {org.disabled_at && <span className="ml-2 badge bg-red-100 text-red-700">DISABLED</span>}
          </h1>
          <p className="text-xs text-gray-500">{org.id}</p>
        </div>
        <form action={startImpersonation}>
          <input type="hidden" name="organization_id" value={org.id} />
          <button className="btn-secondary text-sm">👤 Impersonate</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Customers" value={String(customerCount ?? 0)} />
        <Kpi label="Jobs" value={String(jobCount ?? 0)} />
        <Kpi label="Invoices" value={String(invoiceCount ?? 0)} />
        <Kpi label="Lifetime (last 10 pmt)" value={formatCurrency(lifetime)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Profile + contact */}
        <section className="card-padded">
          <h2 className="font-semibold mb-2">Profile</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-gray-500">Trade</dt><dd className="capitalize">{org.business_type_id?.replace(/_/g, " ")}</dd>
            <dt className="text-gray-500">Email</dt><dd>{org.email ?? "—"}</dd>
            <dt className="text-gray-500">Phone</dt><dd>{org.phone ?? "—"}</dd>
            <dt className="text-gray-500">Slug</dt><dd>{org.slug ?? "—"}</dd>
            <dt className="text-gray-500">Joined</dt><dd>{org.created_at ? formatDate(org.created_at) : "—"}</dd>
            <dt className="text-gray-500">Stripe customer</dt><dd className="font-mono text-xs">{org.stripe_customer_id ?? "—"}</dd>
            <dt className="text-gray-500">Connect acct</dt><dd className="font-mono text-xs">{org.stripe_account_id ?? "—"}</dd>
          </dl>
        </section>

        {/* Subscription */}
        <section className="card-padded">
          <h2 className="font-semibold mb-2">Subscription</h2>
          <p className="text-sm mb-2">
            <span className="badge bg-brand-100 text-brand-700 capitalize">{org.subscription_tier}</span>{" "}
            {org.subscription_status && <span className="badge bg-gray-100 text-gray-700">{org.subscription_status}</span>}
            {trialDaysLeft > 0 && <span className="badge bg-blue-100 text-blue-700">{trialDaysLeft}d trial</span>}
            {(() => { const a = resolveOrgAccess(org as any); return (
              <span className={`badge ${a.hasAccess ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{accessLabel(a)}</span>
            ); })()}
          </p>
          <form action={adjustSubscription} className="space-y-2 text-sm">
            <input type="hidden" name="organization_id" value={org.id} />
            <div>
              <label>Tier</label>
              <select name="subscription_tier" defaultValue={org.subscription_tier} className="w-full">
                <option value="basic">Basic ($5)</option>
                <option value="plus">Plus ($15)</option>
                <option value="pro">Pro ($45)</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select name="subscription_status" defaultValue={org.subscription_status ?? ""} className="w-full">
                <option value="">(unset)</option>
                <option value="trialing">trialing</option>
                <option value="active">active</option>
                <option value="past_due">past_due</option>
                <option value="canceled">canceled</option>
                <option value="trial_expired">trial_expired</option>
              </select>
            </div>
            <div>
              <label>Trial ends at</label>
              <input
                name="trial_ends_at"
                type="datetime-local"
                defaultValue={org.trial_ends_at ? new Date(org.trial_ends_at).toISOString().slice(0, 16) : ""}
                className="w-full"
              />
            </div>
            <button className="btn-primary text-sm">Save subscription</button>
          </form>
        </section>

        {/* Comped (free) access */}
        <section className="card-padded">
          <h2 className="font-semibold mb-2">Free / comped access</h2>
          {org.access_source === "admin_grant" ? (
            <>
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1.5 mb-2">
                <strong>Comped {org.subscription_tier?.toUpperCase()}</strong>
                {org.comped_until
                  ? ` — until ${new Date(org.comped_until).toLocaleString()}`
                  : " — no expiration"}
              </p>
              {org.comped_reason && <p className="text-xs text-gray-600 mb-2">{org.comped_reason}</p>}
              {org.comped_at && <p className="text-[11px] text-gray-400 mb-3">Granted {formatDate(org.comped_at)} by {org.comped_by?.slice(0, 8)}…</p>}
              <form action={removeCompedAccess}>
                <input type="hidden" name="organization_id" value={org.id} />
                <button className="btn-secondary text-sm">Remove comped access</button>
              </form>
              <p className="text-[11px] text-gray-500 mt-2">If they have an active Stripe sub, access will fall back to that. Otherwise the account loses access until they subscribe.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Grant free access to this org — used for friends, beta testers, internal demo accounts. Stripe webhooks won't override this.
              </p>
              <form action={grantCompedAccess} className="space-y-2 text-sm">
                <input type="hidden" name="organization_id" value={org.id} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label>Plan tier</label>
                    <select name="plan_tier" defaultValue="pro" className="w-full">
                      <option value="basic">Basic</option>
                      <option value="plus">Plus</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                  <div>
                    <label>Expires at <span className="text-gray-400">(blank = forever)</span></label>
                    <input name="ends_at" type="datetime-local" className="w-full" />
                  </div>
                </div>
                <div>
                  <label>Reason</label>
                  <input name="reason" placeholder="e.g. Friend account, beta tester" className="w-full" />
                </div>
                <button className="btn-primary text-sm">Grant free access</button>
              </form>
            </>
          )}
        </section>

        {/* Enable / disable */}
        <section className="card-padded">
          <h2 className="font-semibold mb-2">Account state</h2>
          {org.disabled_at ? (
            <>
              <p className="text-sm mb-2 text-red-700">
                Disabled on {formatDate(org.disabled_at)}{org.disabled_reason ? ` — ${org.disabled_reason}` : ""}.
              </p>
              <form action={setOrgDisabled}>
                <input type="hidden" name="organization_id" value={org.id} />
                <input type="hidden" name="disable" value="0" />
                <button className="btn-secondary text-sm">Re-enable account</button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm mb-2 text-gray-600">Disabling blocks login + outbound messaging until re-enabled. Data is preserved.</p>
              <form action={setOrgDisabled} className="space-y-2 text-sm">
                <input type="hidden" name="organization_id" value={org.id} />
                <input type="hidden" name="disable" value="1" />
                <input name="reason" placeholder="Reason (visible internally)" className="w-full" />
                <button className="btn-danger text-sm">Disable account</button>
              </form>
            </>
          )}
        </section>

        {/* Members */}
        <section className="card-padded">
          <h2 className="font-semibold mb-2">Members ({(members ?? []).length})</h2>
          <table className="data-table">
            <thead><tr><th>User</th><th>Role</th><th>Since</th></tr></thead>
            <tbody>
              {(members ?? []).map((m: any) => (
                <tr key={m.user_id}>
                  <td className="font-mono text-xs">{m.user_id}</td>
                  <td className="text-xs capitalize">{m.role}</td>
                  <td className="text-xs text-gray-500">{m.created_at ? formatDate(m.created_at) : "—"}</td>
                </tr>
              ))}
              {(members ?? []).length === 0 && <tr><td colSpan={3} className="text-center text-gray-500 py-4">No members.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <section className="card">
          <header className="px-4 py-3 border-b"><h2 className="font-semibold">Open invoices</h2></header>
          <table className="data-table">
            <thead><tr><th>Number</th><th>Status</th><th>Due</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {(recentInvoices ?? []).map((i: any) => (
                <tr key={i.invoice_number}>
                  <td>{i.invoice_number}</td>
                  <td><span className="badge bg-gray-100 text-gray-700">{i.status}</span></td>
                  <td className="text-xs">{i.due_date ? formatDate(i.due_date) : "—"}</td>
                  <td className="text-right">{formatCurrency(Number(i.balance_due ?? 0))}</td>
                </tr>
              ))}
              {(recentInvoices ?? []).length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-4">No open invoices.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b"><h2 className="font-semibold">Recent payments</h2></header>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {(recentPayments ?? []).map((p: any, i: number) => (
                <tr key={i}>
                  <td className="text-xs">{p.payment_date ? formatDate(p.payment_date) : "—"}</td>
                  <td className="text-xs capitalize">{p.payment_method}</td>
                  <td className="text-right">{formatCurrency(Number(p.amount ?? 0))}</td>
                </tr>
              ))}
              {(recentPayments ?? []).length === 0 && <tr><td colSpan={3} className="text-center text-gray-500 py-4">No payments yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card">
        <header className="px-4 py-3 border-b"><h2 className="font-semibold">Admin actions on this org</h2></header>
        <table className="data-table">
          <thead><tr><th>When</th><th>Action</th><th>Admin</th><th>Payload</th></tr></thead>
          <tbody>
            {(actions ?? []).map((a: any, i: number) => (
              <tr key={i}>
                <td className="text-xs">{formatDate(a.created_at)}</td>
                <td className="text-xs font-mono">{a.action}</td>
                <td className="font-mono text-xs">{a.admin_user_id?.slice(0, 8)}…</td>
                <td className="text-xs text-gray-500 max-w-[400px] truncate">{a.payload ? JSON.stringify(a.payload) : "—"}</td>
              </tr>
            ))}
            {(actions ?? []).length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-4">No admin actions yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
