import { getSessionAndOrg } from "@/lib/org";
import { MixCalculator } from "./calculator";

export const dynamic = "force-dynamic";

export default async function MixPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: chemicals } = await supabase
    .from("chemicals")
    .select("id, name, unit")
    .eq("organization_id", organizationId)
    .order("name");
  const { data: recipes } = await supabase
    .from("chemical_recipes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Chemical mix calculator</h1>
      <p className="text-sm text-gray-600 mb-5">Calculate exact volumes for downstream and direct-injection ratios.</p>
      <MixCalculator chemicals={(chemicals as any) ?? []} recipes={(recipes as any) ?? []} />
    </div>
  );
}
