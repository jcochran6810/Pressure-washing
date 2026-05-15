// Public booking widget. Anyone with the org's slug URL can submit a
// quote request, which writes to the leads table for the operator to
// triage in the in-app /leads queue.

import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { PLATFORM_NAME } from "@/lib/platform";
import { submitLead } from "./actions";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function BookingWidget({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ submitted?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { submitted, error } = (await searchParams) ?? {};
  const supabase = publicClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, phone, email, website, logo_url, business_type_id, address_line1, city, state")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) notFound();

  // Pull this org's published services as a dropdown of what people can book.
  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .eq("organization_id", org.id)
    .eq("active", true)
    .order("name");

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <header className="card-padded mb-5 text-center">
          {org.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-16 max-w-[200px] object-contain mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {[org.phone, org.email].filter(Boolean).join(" • ")}
          </p>
          {org.address_line1 && (
            <p className="text-xs text-gray-400 mt-1">
              {[org.address_line1, org.city, org.state].filter(Boolean).join(", ")}
            </p>
          )}
        </header>

        {submitted ? (
          <section className="card-padded text-center">
            <h2 className="text-xl font-bold text-green-700 mb-2">Thanks — we got it.</h2>
            <p className="text-sm text-gray-600">We'll reach out shortly to confirm details and schedule a time. Watch your email and phone.</p>
          </section>
        ) : (
          <section className="card-padded">
            <h2 className="font-semibold mb-1">Request a quote</h2>
            <p className="text-xs text-gray-500 mb-4">Tell us a little about the job and we'll get back with pricing.</p>

            {error && <div className="mb-3 p-3 rounded-md bg-red-50 text-red-800 text-sm">{error}</div>}

            <form action={submitLead.bind(null, slug)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label>First name</label>
                  <input name="first_name" required className="w-full" />
                </div>
                <div>
                  <label>Last name</label>
                  <input name="last_name" required className="w-full" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label>Email</label>
                  <input name="email" type="email" required className="w-full" />
                </div>
                <div>
                  <label>Phone</label>
                  <input name="phone" type="tel" required className="w-full" />
                </div>
              </div>
              <div>
                <label>Service address</label>
                <input name="address" required className="w-full" placeholder="123 Main St, City, ST" />
              </div>
              {(services?.length ?? 0) > 0 && (
                <div>
                  <label>What service do you need?</label>
                  <select name="service_name" className="w-full">
                    <option value="">— Pick a service —</option>
                    {services!.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    <option value="other">Something else</option>
                  </select>
                </div>
              )}
              <div>
                <label>Tell us about the job</label>
                <textarea name="notes" rows={3} className="w-full" placeholder="Square footage, surface types, any special concerns" />
              </div>
              <div>
                <label>Preferred date (optional)</label>
                <input name="preferred_date" type="date" className="w-full" />
              </div>
              {/* Honeypot — bots fill in, humans don't see it */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <button className="btn-primary w-full text-base py-3">Send request</button>
            </form>
          </section>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
