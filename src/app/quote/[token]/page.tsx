import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import { approveQuote, declineQuote, requestRevision } from "./actions";
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

export default async function PublicQuotePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams?: Promise<{ deposit?: string; approved?: string; action?: string; revised?: string }> }) {
  const { token } = await params;
  const { deposit, approved, action, revised } = (await searchParams) ?? {};
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
  const revise = requestRevision.bind(null, token);
  const focusRevise = action === "revise";
  const focusDecline = action === "decline";
  const focusAccept = action === "accept";

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
          {approved === "1" && !est.deposit_amount && <div className="mt-3 p-3 rounded-md bg-green-50 text-green-800 text-sm">Approved — we'll be in touch shortly.</div>}
          {revised === "1" && <div className="mt-3 p-3 rounded-md bg-blue-50 text-blue-800 text-sm">Revision request sent — we'll be in touch shortly.</div>}
          {deposit === "paid" && <div className="mt-3 p-3 rounded-md bg-green-50 text-green-800 text-sm">Deposit received — thank you. We'll be in touch shortly.</div>}
          {deposit === "canceled" && <div className="mt-3 p-3 rounded-md bg-amber-50 text-amber-800 text-sm">Deposit checkout was canceled. You can retry below.</div>}
          {deposit === "no_connect" && <div className="mt-3 p-3 rounded-md bg-amber-50 text-amber-800 text-sm">Online deposit isn't available right now. We'll follow up with payment details.</div>}
          {deposit === "error" && <div className="mt-3 p-3 rounded-md bg-red-50 text-red-800 text-sm">Something went wrong with the deposit. Please try again or contact us.</div>}
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

        {alreadyResponded && Number(est.deposit_amount) > 0 && !est.deposit_paid && (
          <div className="card-padded mb-4 bg-amber-50 border-amber-200">
            <h2 className="font-semibold mb-1">Deposit due: {formatCurrency(Number(est.deposit_amount))}</h2>
            <p className="text-xs text-gray-600 mb-3">
              Lock in your spot — secure online payment, refundable per terms.
            </p>
            <a href={`/api/quote/${token}/deposit`} className="btn-primary w-full text-base py-3 text-center inline-block">
              Pay deposit
            </a>
          </div>
        )}

        <div className="card-padded mb-4 text-center">
          <a
            href={`/api/quote/${token}/pdf`}
            target="_blank"
            rel="noopener"
            className="btn-secondary inline-block"
          >
            ⬇ Download PDF
          </a>
        </div>

        {!alreadyResponded && !expired && (
          <div className="card-padded">
            <h2 className="font-semibold mb-3">Respond to this estimate</h2>
            <details open={focusAccept || (!focusRevise && !focusDecline)} className="mb-3 border border-green-200 rounded-md">
              <summary className="cursor-pointer px-3 py-2 bg-green-50 text-green-800 font-medium rounded-md">
                ✓ Accept estimate
              </summary>
              <form action={approve} className="space-y-3 p-3">
                <div>
                  <label>Your name (signature)</label>
                  <input name="signature" required className="w-full" />
                </div>
                <button className="btn-primary w-full text-base py-3">Approve estimate</button>
              </form>
            </details>

            <details open={focusRevise} className="mb-3 border border-amber-200 rounded-md">
              <summary className="cursor-pointer px-3 py-2 bg-amber-50 text-amber-800 font-medium rounded-md">
                ✎ Request a revision
              </summary>
              <form action={revise} className="space-y-2 p-3">
                <div>
                  <label>What would you like changed?</label>
                  <textarea name="reason" rows={3} required placeholder="e.g. Please remove the gutter cleaning line, or change the date to..." className="w-full" />
                </div>
                <button className="btn-secondary w-full">Send revision request</button>
              </form>
            </details>

            <details open={focusDecline} className="border border-red-200 rounded-md">
              <summary className="cursor-pointer px-3 py-2 bg-red-50 text-red-800 font-medium rounded-md">
                ✕ Decline
              </summary>
              <form action={decline} className="space-y-2 p-3">
                <textarea name="reason" rows={2} placeholder="Reason (optional)" className="w-full" />
                <button className="btn-ghost text-red-600 text-sm">Decline estimate</button>
              </form>
            </details>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
