import { supabase } from "@/integrations/supabase/client";
import { canonicalOperatorName } from "./operator-normalization";

export type GridOperatorOption = {
  name: string;
  type: "TSO" | "DSO / other";
  featureCount: number;
};

export async function loadGridOperatorCatalog(): Promise<GridOperatorOption[]> {
  const { data, error } = await supabase.rpc("power_finder_public_operators");
  if (error || !Array.isArray(data)) return [];
  const merged = new Map<string, GridOperatorOption>();
  for (const item of data as GridOperatorOption[]) {
    const name = canonicalOperatorName(item.name);
    if (!name) continue;
    const previous = merged.get(name);
    merged.set(name, {
      name,
      type: item.type,
      featureCount: (previous?.featureCount ?? 0) + Number(item.featureCount ?? 0),
    });
  }
  return [...merged.values()].sort(
    (left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name),
  );
}
