import type { PowerFinderFeature } from "@/features/power-finder/fixture-data";

export type ScreeningScore = {
  total: number;
  label: "limited context" | "useful context" | "strong screening context";
  components: { label: string; points: number; maximum: number; reason: string }[];
  boundary: string;
};

export function scoreFeature(feature: PowerFinderFeature): ScreeningScore | null {
  if (feature.properties.kind !== "node") return null;
  const props = feature.properties;
  const maximumVoltage = Math.max(0, ...(props.voltage_kv ?? []));
  const voltagePoints =
    maximumVoltage >= 380
      ? 35
      : maximumVoltage >= 220
        ? 30
        : maximumVoltage >= 110
          ? 24
          : maximumVoltage > 0
            ? 12
            : 0;
  const sourcePoints =
    props.evidence_class === "official_operator"
      ? 25
      : props.evidence_class === "official_regulatory" || props.evidence_class === "official_public"
        ? 20
        : props.evidence_class === "open_mapping"
          ? 10
          : 0;
  const operatorPoints = props.operator ? 15 : 0;
  const statusPoints = props.status === "operational" ? 10 : props.status ? 5 : 0;
  const capacityPoints =
    props.capacity_state === "published_exact"
      ? 15
      : props.capacity_state === "published_band"
        ? 12
        : props.capacity_state === "feasible_no_mw"
          ? 6
          : 0;
  const components = [
    {
      label: "Voltage context",
      points: voltagePoints,
      maximum: 35,
      reason: maximumVoltage
        ? `Highest mapped voltage is ${maximumVoltage} kV.`
        : "Voltage is unknown.",
    },
    {
      label: "Source authority",
      points: sourcePoints,
      maximum: 25,
      reason: `Evidence class is ${props.evidence_class.replaceAll("_", " ")}.`,
    },
    {
      label: "Operator identity",
      points: operatorPoints,
      maximum: 15,
      reason: props.operator
        ? "A mapped operator name is present."
        : "Operator requires confirmation.",
    },
    {
      label: "Operational context",
      points: statusPoints,
      maximum: 10,
      reason: props.status ? `Mapped status is ${props.status}.` : "Operational status is unknown.",
    },
    {
      label: "Published demand capacity",
      points: capacityPoints,
      maximum: 15,
      reason:
        capacityPoints > 0
          ? `Capacity evidence is classified as ${props.capacity_state}.`
          : "No published demand-capacity evidence is attached.",
    },
  ];
  const total = components.reduce((sum, component) => sum + component.points, 0);
  return {
    total,
    label:
      total >= 70 ? "strong screening context" : total >= 40 ? "useful context" : "limited context",
    components,
    boundary:
      "This score measures screening-data completeness and authority. It is not a probability of connection, available MW, cost, or delivery date.",
  };
}
