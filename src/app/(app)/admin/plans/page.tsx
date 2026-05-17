import { requirePlatformAdmin } from "@/lib/admin";
import { upsertPlan, deletePlan, broadcastPriceChange } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order");

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Subscription plans</h1>
      <p className="text-sm text-gray-500 mb-6">
        Edit pricing tiers shown on <a href="/pricing" className="text-brand-600">/pricing</a>.
        Stripe Price IDs are still the source of truth for actual charges — change those in Stripe Dashboard first, then sync here.
      </p>

      <section className="space-y-4 mb-8">
        {(plans ?? []).map((p) => (
          <PlanEditor key={p.id} plan={p as any} />
        ))}
      </section>

      <section className="card-padded">
        <h2 className="font-semibold mb-3">Add new plan</h2>
        <form action={upsertPlan} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label>Slug</label><input name="slug" required className="w-full" placeholder="pro" /></div>
          <div><label>Display name</label><input name="name" required className="w-full" placeholder="Pro" /></div>
          <div className="sm:col-span-2"><label>Description</label><input name="description" className="w-full" placeholder="For growing teams" /></div>
          <div><label>Monthly amount ($)</label><input name="monthly_amount" type="number" step="0.01" min="0" required className="w-full" /></div>
          <div><label>Annual amount ($)</label><input name="annual_amount" type="number" step="0.01" min="0" className="w-full" /></div>
          <div><label>Stripe price ID (monthly)</label><input name="stripe_price_id_monthly" className="w-full" placeholder="price_..." /></div>
          <div><label>Stripe price ID (annual)</label><input name="stripe_price_id_annual" className="w-full" placeholder="price_..." /></div>
          <div className="sm:col-span-2"><label>Features (one per line)</label><textarea name="features" rows={5} className="w-full" placeholder="Unlimited customers&#10;Stripe payment links&#10;..."></textarea></div>
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2"><input type="checkbox" name="is_featured" /> Featured</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked /> Active</label>
            <input name="sort_order" type="number" defaultValue={(plans?.length ?? 0) * 10} className="w-20" />
          </div>
          <div className="sm:col-span-2 text-right">
            <button className="btn-primary">Add plan</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PlanEditor({ plan }: { plan: any }) {
  const action = upsertPlan;
  const broadcast = broadcastPriceChange.bind(null, plan.id);
  const features = Array.isArray(plan.features) ? plan.features.join("\n") : "";
  return (
    <div className="card-padded">
      <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input type="hidden" name="id" value={plan.id} />
        <div><label>Slug</label><input name="slug" defaultValue={plan.slug} required className="w-full" /></div>
        <div><label>Display name</label><input name="name" defaultValue={plan.name} required className="w-full" /></div>
        <div className="sm:col-span-2"><label>Description</label><input name="description" defaultValue={plan.description ?? ""} className="w-full" /></div>
        <div><label>Monthly amount ($)</label><input name="monthly_amount" type="number" step="0.01" min="0" defaultValue={plan.monthly_amount} required className="w-full" /></div>
        <div><label>Annual amount ($)</label><input name="annual_amount" type="number" step="0.01" min="0" defaultValue={plan.annual_amount ?? ""} className="w-full" /></div>
        <div><label>Stripe price ID (monthly)</label><input name="stripe_price_id_monthly" defaultValue={plan.stripe_price_id_monthly ?? ""} className="w-full" /></div>
        <div><label>Stripe price ID (annual)</label><input name="stripe_price_id_annual" defaultValue={plan.stripe_price_id_annual ?? ""} className="w-full" /></div>
        <div className="sm:col-span-2"><label>Features</label><textarea name="features" rows={5} defaultValue={features} className="w-full" /></div>
        <div className="flex gap-3 items-center sm:col-span-2 flex-wrap">
          <label className="flex items-center gap-2"><input type="checkbox" name="is_featured" defaultChecked={plan.is_featured} /> Featured</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={plan.is_active} /> Active</label>
          <input name="sort_order" type="number" defaultValue={plan.sort_order} className="w-20" />
          <span className="flex-1" />
          <button className="btn-secondary">Save</button>
        </div>
      </form>

      <details className="mt-3 border-t border-gray-100 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-amber-700">
          Notify all customers about a price change
        </summary>
        <form action={broadcast} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="text-xs">Old amount</label><input name="old_amount" type="number" step="0.01" required className="w-full" placeholder="49" /></div>
            <div><label className="text-xs">New amount</label><input name="new_amount" type="number" step="0.01" required className="w-full" placeholder="59" defaultValue={plan.monthly_amount} /></div>
            <div><label className="text-xs">Effective date</label><input name="effective_date" type="date" required className="w-full" defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} /></div>
          </div>
          <div>
            <label className="text-xs">Custom message (optional)</label>
            <textarea
              name="custom_message"
              rows={3}
              className="w-full"
              placeholder="Hi! We're investing more in [feature]. To keep the lights on, prices are going up a touch on [date]. Thanks for being with us!"
            />
          </div>
          <p className="text-xs text-gray-500">
            Sends an email to every customer on this plan. Be sure to give 30 days&apos; notice per the Terms of Service.
          </p>
          <div className="text-right">
            <button className="btn-secondary text-sm">Send broadcast</button>
          </div>
        </form>
      </details>

      <form action={deletePlan.bind(null, plan.id)} className="mt-3 text-right">
        <button className="btn-ghost text-red-600 text-xs">Delete plan</button>
      </form>
    </div>
  );
}
