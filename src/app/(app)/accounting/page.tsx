import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatDate } from "@/lib/utils";
import { qboConfigured } from "@/lib/qbo";
import { CsvDownloadForm } from "@/components/csv-download-form";
import { DownloadAllForm } from "@/components/download-all-form";
import {
  exportInvoicesCsv,
  exportPaymentsCsv,
  exportExpensesCsv,
  exportCustomersCsv,
  exportAllCsvZip,
  pushAllUnsyncedInvoicesToQbo,
  disconnectQbo,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ qbo?: string; msg?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { qbo, msg } = await searchParams;
  const { data: conn } = await (supabase as any)
    .from("qbo_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const { data: history } = await (supabase as any)
    .from("accounting_exports")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const qboReady = qboConfigured();

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Accounting sync</h1>
      <p className="text-sm text-gray-600 mb-5">
        Download CSVs for QuickBooks / Xero / Wave / FreshBooks — or push invoices live to QuickBooks Online.
      </p>

      {qbo === "connected" && <Notice tone="ok">QuickBooks Online connected.</Notice>}
      {qbo === "error" && <Notice tone="error">QuickBooks connect failed{msg ? `: ${msg}` : "."}</Notice>}
      {qbo === "not_configured" && <Notice tone="error">QBO_CLIENT_ID / QBO_CLIENT_SECRET are not set in this environment.</Notice>}

      <section className="card-padded mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">QuickBooks Online</h2>
            <p className="text-sm text-gray-600">
              {conn
                ? `Connected · realm ${conn.realm_id} (${conn.environment})`
                : "Connect your QBO company to push invoices and customers live."}
            </p>
          </div>
          <div className="flex gap-2">
            {!conn && qboReady && <Link href="/api/accounting/qbo/connect" className="btn-secondary">Connect QBO</Link>}
            {!conn && !qboReady && <span className="badge bg-gray-100 text-gray-700">Not configured</span>}
            {conn && (
              <>
                <form action={pushAllUnsyncedInvoicesToQbo}><button className="btn-primary text-sm">Push unsynced invoices</button></form>
                <form action={disconnectQbo}><button className="btn-ghost text-red-600 text-sm">Disconnect</button></form>
              </>
            )}
          </div>
        </div>
        {!qboReady && (
          <p className="text-xs text-gray-500 mt-2">
            Set <code>QBO_CLIENT_ID</code>, <code>QBO_CLIENT_SECRET</code>, <code>QBO_REDIRECT_URI</code>, and <code>QBO_ENVIRONMENT</code> to enable.
          </p>
        )}
      </section>

      <h2 className="font-semibold mb-2">CSV exports</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <DownloadAllForm action={exportAllCsvZip} />
        <CsvDownloadForm
          action={exportInvoicesCsv}
          filename={`invoices-${stamp}.csv`}
          label="Invoices"
          hint="One row per invoice; totals, tax, balance due. Compatible with QBO import."
        />
        <CsvDownloadForm
          action={exportPaymentsCsv}
          filename={`payments-${stamp}.csv`}
          label="Payments"
          hint="Cash, check, ACH, card, Stripe. Filter by date range."
        />
        <CsvDownloadForm
          action={exportExpensesCsv}
          filename={`expenses-${stamp}.csv`}
          label="Expenses"
          hint="With vendor, category, and tax-deductible flag."
        />
        <CsvDownloadForm
          action={exportCustomersCsv}
          filename={`customers-${stamp}.csv`}
          label="Customers"
          hint="Contact directory export. No date range."
          withDateRange={false}
        />
      </div>

      <section className="card mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Recent exports</h2>
        </header>
        {!history?.length ? (
          <p className="p-4 text-sm text-gray-500">No exports yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {history.map((h: any) => (
              <li key={h.id} className="px-4 py-2 flex justify-between gap-3">
                <span className="capitalize">{h.kind} · {h.format}</span>
                <span className="text-gray-500">{h.row_count} rows</span>
                <span className="text-gray-400 text-xs">{formatDate(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200";
  return <div className={`border rounded-md p-3 text-sm mb-4 ${cls}`}>{children}</div>;
}
