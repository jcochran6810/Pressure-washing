import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Suds
        </div>
        <nav className="flex gap-2">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:pt-20">
        <div className="max-w-2xl">
          <span className="badge bg-brand-100 text-brand-700 mb-4">All-in-one for pressure washers</span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-900">
            Run your pressure washing business from one app.
          </h1>
          <p className="mt-5 text-lg text-gray-600">
            Customers, estimates, scheduling, invoicing, chemicals, expenses, and marketing —
            on your phone in the truck or your laptop at the office.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary text-base px-5 py-3">Start free</Link>
            <Link href="/login" className="btn-secondary text-base px-5 py-3">I have an account</Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Customers + Properties", body: "CRM purpose-built for service businesses with multi-property tracking." },
            { title: "Estimates", body: "Build quotes from your service catalog, send to customers, convert to jobs." },
            { title: "Scheduling", body: "Schedule jobs, assign crews, log before/after photos, track status in the field." },
            { title: "Invoicing + Payments", body: "Send invoices, log payments, optional Stripe payment links." },
            { title: "Chemicals + Inventory", body: "Track SH, surfactants, equipment hours, reorder levels, and SDS sheets." },
            { title: "Accounting + Marketing", body: "Expense tracking, P&L, lead pipeline, and ad spend ROI." },
          ].map((f) => (
            <div key={f.title} className="card-padded">
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
