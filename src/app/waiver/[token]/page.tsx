import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { customerDisplayName, formatDate } from "@/lib/utils";
import { signWaiver } from "./actions";
import { SignaturePad } from "@/components/signature-pad";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function PublicWaiverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = publicClient();
  const { data: sig } = await (supabase as any)
    .from("waiver_signatures")
    .select("*, waivers(*), organizations:waivers(organization_id), customers(*)")
    .eq("token", token)
    .maybeSingle();

  if (!sig) notFound();
  const w = sig.waivers;
  if (!w) notFound();

  const alreadySigned = sig.status === "signed";
  const declined = sig.status === "declined";

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="card-padded mb-4">
          <p className="text-sm text-gray-500">Service waiver</p>
          <h1 className="text-2xl font-bold">{w.name}</h1>
          {sig.customers && (
            <p className="text-sm text-gray-600 mt-1">
              For {customerDisplayName(sig.customers)}
              {sig.signed_at && ` · signed ${formatDate(sig.signed_at)}`}
            </p>
          )}
        </div>

        <div className="card-padded mb-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">{w.body}</pre>
        </div>

        {alreadySigned ? (
          <div className="card-padded text-center text-green-800 bg-green-50 border-green-200">
            <p className="font-semibold">✓ Signed</p>
            <p className="text-sm mt-1">Thanks for signing. A copy is on file with {sig.signed_at ? formatDate(sig.signed_at) : "us"}.</p>
            {sig.signature_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sig.signature_image_url} alt="signature" className="mx-auto mt-3 max-h-24 border rounded" />
            )}
          </div>
        ) : declined ? (
          <div className="card-padded text-center text-red-800 bg-red-50 border-red-200">
            <p className="font-semibold">Declined</p>
            <p className="text-sm mt-1">You declined to sign this waiver. Contact us if this was a mistake.</p>
          </div>
        ) : (
          <form action={signWaiver.bind(null, token)} className="card-padded space-y-4">
            <h2 className="font-semibold">Sign below</h2>
            <div>
              <label>Full name (typed)</label>
              <input
                name="signer_name"
                required
                defaultValue={
                  sig.customers
                    ? customerDisplayName(sig.customers)
                    : ""
                }
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label>Email</label>
                <input name="signer_email" type="email" defaultValue={sig.signer_email ?? sig.customers?.email ?? ""} className="w-full" />
              </div>
              <div>
                <label>Phone</label>
                <input name="signer_phone" type="tel" defaultValue={sig.signer_phone ?? sig.customers?.phone ?? ""} className="w-full" />
              </div>
            </div>
            <div>
              <label>Draw your signature</label>
              <SignaturePad name="signature_data" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="agree" required className="mt-0.5" />
              <span>I have read and agree to the terms above, and I am the property owner or am authorized to approve this work.</span>
            </label>
            <div className="flex justify-end">
              <button className="btn-primary w-full sm:w-auto text-base py-3 px-6">✓ Sign waiver</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
