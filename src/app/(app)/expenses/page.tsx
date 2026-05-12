import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { deleteExpense } from "./actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase.from("expenses").select("*, expense_categories(name)").eq("organization_id", organizationId).order("expense_date", { ascending: false }),
    supabase.from("expense_categories").select("*").eq("organization_id", organizationId).order("name"),
  ]);

  const monthTotal = (expenses ?? []).filter((e: any) => new Date(e.expense_date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0);
  const ytdTotal = (expenses ?? []).filter((e: any) => new Date(e.expense_date).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <PageHeader title="Expenses" description="Track every dollar going out — fuel, chemicals, insurance, payroll." action={{ label: "New expense", href: "/expenses/new" }} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="This month" value={formatCurrency(monthTotal)} />
        <Stat label="Year to date" value={formatCurrency(ytdTotal)} />
        <Stat label="Categories" value={String(categories?.length ?? 0)} />
        <Stat label="Records" value={String(expenses?.length ?? 0)} />
      </div>

      {!expenses?.length ? (
        <EmptyState title="No expenses logged" action={{ label: "New expense", href: "/expenses/new" }} />
      ) : (
        <div className="table-wrap overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th className="hidden sm:table-cell">Description</th><th className="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              {expenses.map((e: any) => {
                const del = deleteExpense.bind(null, e.id);
                return (
                  <tr key={e.id}>
                    <td>{formatDate(e.expense_date)}</td>
                    <td className="font-medium">{e.vendor || "—"}</td>
                    <td>{e.expense_categories?.name || "Uncategorized"}</td>
                    <td className="hidden sm:table-cell text-gray-500 max-w-xs truncate">{e.description}</td>
                    <td className="text-right font-medium">{formatCurrency(Number(e.amount))}</td>
                    <td><form action={del}><button className="text-xs text-red-600 hover:underline">✕</button></form></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
