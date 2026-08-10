import { supabase } from "@/integrations/supabase/client";
import { canonicalOperatorName } from "./operator-normalization";
import { mergeOperatorBounds, type OperatorBounds } from "./operator-map-navigation";

export type GridOperatorOption = {
  name: string;
  type: "TSO" | "DSO / other";
  featureCount: number;
  bounds: OperatorBounds | null;
  tsoNames: string[];
};

function validBounds(value: unknown): value is OperatorBounds {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((coordinate) => Number.isFinite(Number(coordinate))) &&
    Number(value[0]) < Number(value[2]) &&
    Number(value[1]) < Number(value[3])
  );
}

export async function loadGridOperatorCatalog(): Promise<GridOperatorOption[]> {
  const { data, error } = await supabase.rpc("power_finder_public_operators");
  if (error || !Array.isArray(data)) return [];
  const merged = new Map<string, GridOperatorOption>();
  for (const item of data as GridOperatorOption[]) {
    const name = canonicalOperatorName(item.name);
    if (!name) continue;
    const previous = merged.get(name);
    const bounds = validBounds(item.bounds) ? (item.bounds.map(Number) as OperatorBounds) : null;
    const tsoNames = Array.isArray(item.tsoNames)
      ? item.tsoNames
          .map((value) => canonicalOperatorName(String(value)))
          .filter((value): value is string => Boolean(value))
      : [];
    merged.set(name, {
      name,
      type: previous?.type === "TSO" || item.type === "TSO" ? "TSO" : "DSO / other",
      featureCount: (previous?.featureCount ?? 0) + Number(item.featureCount ?? 0),
      bounds: mergeOperatorBounds(previous?.bounds ?? null, bounds),
      tsoNames: [...new Set([...(previous?.tsoNames ?? []), ...tsoNames])].sort(),
    });
  }
  return [...merged.values()].sort(
    (left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name),
  );
}
