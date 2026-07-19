import type { CapacitySnapshot, NetworkNode } from "@/lib/assessment-model";

export function latestCapacityByNode(snapshots: CapacitySnapshot[]) {
  const latest = new Map<string, CapacitySnapshot>();
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.node_id);
    if (!current || snapshot.version > current.version) latest.set(snapshot.node_id, snapshot);
  }
  return latest;
}

export function capacityTruth(snapshot?: CapacitySnapshot) {
  if (!snapshot) return { label: "No capacity evidence", level: "missing" as const };
  if (snapshot.status === "operator_confirmed")
    return { label: "Operator-confirmed source", level: "confirmed" as const };
  if (snapshot.status === "reviewed")
    return { label: "Reviewed planning evidence", level: "reviewed" as const };
  return { label: "Screening evidence only", level: "screening" as const };
}

export function nodeDisplayName(node: NetworkNode) {
  return [node.node_name, node.node_code, `${node.voltage_kv} kV`].filter(Boolean).join(" · ");
}

export function parseJsonObject(value: string) {
  if (!value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw new Error("Enter a JSON object, for example {\"peak_mw\": 40}.");
  return parsed as Record<string, unknown>;
}
