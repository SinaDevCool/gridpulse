import type { PowerFinderFeature } from "@/features/power-finder/fixture-data";

export type ScreeningScore = {
  total: number;
  label:
    | "limited evidence completeness"
    | "moderate evidence completeness"
    | "higher evidence completeness";
  components: { label: string; points: number; maximum: number; reason: string }[];
  boundary: string;
};

export type EvidenceConfidenceLevel =
  | "confirmed"
  | "corroborated"
  | "mapped"
  | "inferred"
  | "unknown";

export type EvidenceConfidenceItem = {
  label: string;
  level: EvidenceConfidenceLevel;
  value: string;
  reason: string;
};

function authoritativeSource(feature: PowerFinderFeature) {
  return ["official_operator", "official_regulatory", "official_public"].includes(
    feature.properties.evidence_class,
  );
}

export function evidenceConfidence(
  feature: PowerFinderFeature,
  fallbackPublishedAt?: string,
): EvidenceConfidenceItem[] {
  if (feature.properties.kind !== "node") return [];
  const props = feature.properties;
  const authoritative = authoritativeSource(feature);
  const voltageAccepted =
    Boolean(props.voltage_kv?.length) &&
    !["ambiguous", "implausible"].includes(props.voltage_evidence_status ?? "accepted");
  const publishedAt = props.source_published_at ?? fallbackPublishedAt;
  const parsedPublishedAt = publishedAt ? new Date(publishedAt) : null;
  const validPublishedAt = parsedPublishedAt && !Number.isNaN(parsedPublishedAt.getTime());
  const publishedLabel = validPublishedAt
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(
        parsedPublishedAt,
      )
    : "Date unavailable";

  return [
    {
      label: "Voltage",
      level: voltageAccepted ? (authoritative ? "confirmed" : "mapped") : "unknown",
      value: voltageAccepted ? `${Math.max(...(props.voltage_kv ?? []))} kV` : "Unknown",
      reason: voltageAccepted
        ? authoritative
          ? "Published by an authoritative source."
          : "Present in the accepted open-mapping record."
        : "No accepted voltage observation is available.",
    },
    {
      label: "Asset Identity",
      level: props.name && feature.id ? (authoritative ? "confirmed" : "mapped") : "unknown",
      value: props.name && feature.id ? "Name & Source ID Present" : "Incomplete",
      reason:
        props.name && feature.id
          ? "The feature has a traceable name and source record identifier."
          : "A traceable name or source identifier is missing.",
    },
    {
      label: "Operator Responsibility",
      level: props.operator ? (authoritative ? "confirmed" : "mapped") : "unknown",
      value: props.operator ? "Operator Tag Present" : "Confirmation Required",
      reason: props.operator
        ? authoritative
          ? "Operator identity comes from an authoritative source."
          : "The operator is attributed by public mapping and still requires confirmation."
        : "No operator attribution is present.",
    },
    {
      label: "Operating Status",
      level: props.status ? (authoritative ? "confirmed" : "inferred") : "unknown",
      value: props.status ? props.status.replaceAll("_", " ") : "Unknown",
      reason: props.status
        ? authoritative
          ? "Lifecycle status is published by an authoritative source."
          : "Open mapping infers operation when the asset is not tagged proposed or under construction."
        : "No lifecycle status is available.",
    },
    {
      label: "Source Recency",
      level: validPublishedAt ? "mapped" : "unknown",
      value: publishedLabel,
      reason: validPublishedAt
        ? "This is the source-release date, not an operator confirmation date."
        : "No usable source-release date is available.",
    },
    {
      label: "Capacity Evidence",
      level:
        props.capacity_state === "published_exact" || props.capacity_state === "published_band"
          ? authoritative
            ? "confirmed"
            : "corroborated"
          : "unknown",
      value:
        props.capacity_state === "published_exact"
          ? `${props.exact_mw ?? "—"} MW Published`
          : props.capacity_state === "published_band"
            ? `${props.band_min_mw ?? "—"}–${props.band_max_mw ?? "—"} MW Published`
            : "Not Published or Operator-Confirmed",
      reason:
        props.capacity_state === "published_exact" || props.capacity_state === "published_band"
          ? "The accepted record contains published node-specific capacity evidence."
          : "No accepted node-specific import or export capacity evidence is available.",
    },
  ];
}

export function scoreFeature(feature: PowerFinderFeature): ScreeningScore | null {
  if (feature.properties.kind !== "node") return null;
  const props = feature.properties;
  const voltageValues = ["ambiguous", "implausible"].includes(
    props.voltage_evidence_status ?? "accepted",
  )
    ? []
    : (props.voltage_kv ?? []);
  const maximumVoltage = Math.max(0, ...voltageValues);
  const voltagePoints = maximumVoltage > 0 ? 20 : 0;
  const sourcePoints =
    props.evidence_class === "official_operator"
      ? 30
      : props.evidence_class === "official_regulatory" || props.evidence_class === "official_public"
        ? 24
        : props.evidence_class === "open_mapping"
          ? 12
          : 0;
  const operatorPoints = props.operator ? 15 : 0;
  const assetIdentityPoints = props.name && String(feature.id) ? 15 : props.name ? 8 : 0;
  const statusPoints = props.status === "operational" ? 10 : props.status ? 5 : 0;
  const freshnessPoints = props.evidence_class === "test_fixture" ? 0 : 10;
  const components = [
    {
      label: "Voltage context",
      points: voltagePoints,
      maximum: 20,
      reason: maximumVoltage
        ? `Highest mapped voltage is ${maximumVoltage} kV.`
        : "Voltage is unknown.",
    },
    {
      label: "Source authority",
      points: sourcePoints,
      maximum: 30,
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
      label: "Asset identity",
      points: assetIdentityPoints,
      maximum: 15,
      reason:
        assetIdentityPoints === 15
          ? "A mapped name and source identifier are present."
          : "Asset identity is incomplete.",
    },
    {
      label: "Operational context",
      points: statusPoints,
      maximum: 10,
      reason: props.status ? `Mapped status is ${props.status}.` : "Operational status is unknown.",
    },
    {
      label: "Data freshness",
      points: freshnessPoints,
      maximum: 10,
      reason:
        freshnessPoints > 0
          ? "The feature belongs to an accepted source release; review its date in provenance."
          : "No accepted source-release freshness is available.",
    },
  ];
  const total = components.reduce((sum, component) => sum + component.points, 0);
  return {
    total,
    label:
      total >= 70
        ? "higher evidence completeness"
        : total >= 40
          ? "moderate evidence completeness"
          : "limited evidence completeness",
    components,
    boundary:
      "The Evidence Readiness Score measures public-source completeness only. It does not establish technical compatibility, connection probability, available MW, cost, or delivery date.",
  };
}
