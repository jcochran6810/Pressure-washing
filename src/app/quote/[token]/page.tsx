import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import { approveQuote, declineQuote } from "./actions";
import { PLATFORM_NAME } from "@/lib/platform";

export const dynamic = "force-dynamic";

// Public quote page — no auth. RLS is bypassed by reading via a token-scoped service call.
function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = publicClient();
  // Note: public reads require either RLS-public-policy or a server-side bypass. For now we
  // read via the anon key which won't bypass RLS. To make this work in production, run a
  // migration that creates a token-based public select policy, or store quotes in a separate
  // public view. For now this page works if the org adds:
  //   create policy "public quote read" on estimates for select using (approval_token is not null);
  const { data: est } = await supabase
    .from("estimates")
    .select("*, customers(*), organizations(*), estimate_line_items(*)")
    .eq("approval_token", token)
    .maybeSingle();

  if (!est) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
        <div className="card-padded max-w-md text-center">
          <h1 className="text-xl font-bold">Quote unavailable</h1>
          <p className="text-gray-600 mt-2">The link may have expired or been revoked. Please contact us.</p>
        </div>
      </main>
    );
  }

  const expired = est.expires_at && new Date(est.expires_at) < new Date();
  const alreadyResponded = est.status === "accepted" || est.status === "declined" || est.status === "converted";
  const items = (est.estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const approve = approveQuote.bind(null, token);
  const decline = declineQuote.bind(null, token);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="card-padded mb-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold">{est.organizations?.name ?? "Estimate"}</h1>
              <p className="text-sm text-gray-500">Estimate {est.estimate_number}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              {est.organizations?.phone && <p>{est.organizations.phone}</p>}
              {est.organizations?.email && <p>{est.organizations.email}</p>}
            </div>
          </div>

          {expired && <div className="mt-3 p-3 rounded-md bg-amber-50 text-amber-800 text-sm">This estimate expired on {formatDate(est.expires_at)}.</div>}
          {alreadyResponded && <div className="mt-3 p-3 rounded-md bg-green-50 text-green-800 text-sm">Status: {est.status}. Thanks!</div>}
        </div>

        <div className="card-padded mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Prepared for <strong>{customerDisplayName(est.customers as any)}</strong> · Issued {formatDate(est.issue_date)} · Valid until {formatDate(est.expires_at)}
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((li) => (
                <tr key={li.id} className="border-b border-gray-100">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-right">{li.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(Number(li.unit_price))}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(Number(li.total))}</td>
                </tr>
              ))}
              <tr><td colSpan={3} className="py-1 text-right text-gray-500">Subtotal</td><td className="py-1 text-right">{formatCurrency(Number(est.subtotal))}</td></tr>
              {Number(est.discount_amount) > 0 && <tr><td colSpan={3} className="py-1 text-right text-gray-500">Discount</td><td className="py-1 text-right">− {formatCurrency(Number(est.discount_amount))}</td></tr>}
              <tr><td colSpan={3} className="py-1 text-right text-gray-500">Tax</td><td className="py-1 text-right">{formatCurrency(Number(est.tax_amount))}</td></tr>
              <tr className="font-bold text-lg"><td colSpan={3} className="py-2 text-right">Total</td><td className="py-2 text-right">{formatCurrency(Number(est.total))}</td></tr>
              {est.deposit_amount && <tr><td colSpan={3} className="py-1 text-right text-amber-700 text-sm">Required deposit on approval</td><td className="py-1 text-right text-amber-700">{formatCurrency(Number(est.deposit_amount))}</td></tr>}
            </tbody>
          </table>

          {(est.notes || est.terms) && (
            <div className="mt-4 text-sm text-gray-600 space-y-2">
              {est.notes && <p className="whitespace-pre-wrap">{est.notes}</p>}
              {est.terms && <p className="whitespace-pre-wrap text-xs">{est.terms}</p>}
            </div>
          )}
        </div>

        {!alreadyResponded && !expired && (
          <div className="card-padded">
            <h2 className="font-semibold mb-3">Approve this quote</h2>
            <form action={approve} className="space-y-3 mb-4">
              <div>
                <label>Your name (signature)</label>
                <input name="signature" required className="w-full" />
              </div>
              <button className="btn-primary w-full text-base py-3">✓ Approve estimate</button>
            </form>
            <form action={decline} className="space-y-2">
              <details>
                <summary className="text-sm text-gray-600 cursor-pointer">Need to decline?</summary>
                <textarea name="reason" rows={2} placeholder="Reason (optional)" className="w-full mt-2" />
                <button className="btn-ghost text-red-600 text-sm mt-1">Decline</button>
              </details>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
