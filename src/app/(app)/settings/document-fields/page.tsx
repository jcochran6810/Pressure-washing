import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import {
  resolveEstimateFields, resolveInvoiceFields, resolveReceiptFields,
  ESTIMATE_FIELD_LABELS, INVOICE_FIELD_LABELS, RECEIPT_FIELD_LABELS,
} from "@/lib/document-fields";
import { updateDocumentFields, togglePremiumTemplates } from "./actions";

export const dynamic = "force-dynamic";

export default async function DocumentFieldsPage() {
  const { supabase, organization } = await getSessionAndOrg();

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("slug, name, premium_templates_allowed, premium_templates_amount")
    .eq("slug", (organization as any)?.subscription_plan ?? "starter")
    .maybeSingle();

  const eligible = plan?.premium_templates_allowed === true;
  const enabled = (organization as any)?.premium_templates_enabled === true;
  const cfg = (organization as any)?.document_field_visibility ?? {};
  const estimate = resolveEstimateFields(cfg);
  const invoice = resolveInvoiceFields(cfg);
  const receipt = resolveReceiptFields(cfg);
  const price = Number(plan?.premium_templates_amount ?? 5);

  if (!eligible) {
    return (
      <div className="max-w-2xl">
        <Link href="/settings" className="text-sm text-brand-600 hover:underline">← Settings</Link>
        <h1 className="text-2xl font-bold mt-2 mb-3">Document customization</h1>
        <div className="card-padded border-l-4 border-amber-400 bg-amber-50">
          <p className="font-semibold mb-1">Available on Plus and Pro</p>
          <p className="text-sm text-gray-700">
            Premium templates let you choose which fields appear on the documents
            your customers see. Upgrade to Plus or Pro to enable.
          </p>
          <Link href="/billing" className="btn-primary text-sm mt-3 inline-block">Upgrade plan</Link>
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-2xl">
        <Link href="/settings" className="text-sm text-brand-600 hover:underline">← Settings</Link>
        <h1 className="text-2xl font-bold mt-2 mb-3">Document customization</h1>
        <div className="card-padded">
          <p className="font-semibold mb-2">Premium Templates add-on — ${price}/month</p>
          <p className="text-sm text-gray-700 mb-4">
            Pick which fields appear on your customer-facing estimates, invoices, and receipts.
            For example: hide tax lines if you don&apos;t charge tax, or hide the
            &quot;Prepared by&quot; signature if you want a cleaner look.
          </p>
          <form action={togglePremiumTemplates}>
            <input type="hidden" name="enable" value="1" />
            <button className="btn-primary">Enable for ${price}/month</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/settings" className="text-sm text-brand-600 hover:underline">← Settings</Link>
      <div className="flex items-start justify-between flex-wrap gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Document customization</h1>
          <p className="text-sm text-gray-500">Toggle fields on each document type. Changes apply to all future and re-rendered documents.</p>
        </div>
        <form action={togglePremiumTemplates}>
          <input type="hidden" name="enable" value="0" />
          <button className="btn-ghost text-red-600 text-xs">Disable add-on</button>
        </form>
      </div>

      <form action={updateDocumentFields} className="space-y-5">
        <Section title="Estimates" prefix="estimate" labels={ESTIMATE_FIELD_LABELS} current={estimate} />
        <Section title="Invoices" prefix="invoice" labels={INVOICE_FIELD_LABELS} current={invoice} />
        <Section title="Receipts" prefix="receipt" labels={RECEIPT_FIELD_LABELS} current={receipt} />

        <div className="flex gap-2 justify-end">
          <Link href="/settings" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, prefix, labels, current }: { title: string; prefix: string; labels: Record<string, string>; current: any }) {
  return (
    <section className="card-padded">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(labels).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer p-2 hover:bg-gray-50 rounded">
            <input
              type="checkbox"
              name={`${prefix}__${key}`}
              defaultChecked={(current as any)[key] !== false}
            />
            <span dangerouslySetInnerHTML={{ __html: label }} />
          </label>
        ))}
      </div>
    </section>
  );
}
