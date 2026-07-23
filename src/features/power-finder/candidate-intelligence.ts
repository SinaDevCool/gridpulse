import type { Geometry, Position } from "geojson";
import type {
  PowerFinderCollection,
  PowerFinderEvidenceClass,
  PowerFinderFeature,
} from "./fixture-data";
import { scoreFeature } from "./screening-score";

export type VoltageFit = "compatible" | "conditional" | "unknown";
export type CandidateConfidence = "high" | "medium" | "low";

export type CandidateOpportunity = {
  id: string;
  siteId: string;
  nodeId: string;
  siteName: string;
  nodeName: string;
  operator: string | null;
  voltageKv: number[];
  distanceKm: number;
  contextScore: number;
  evidenceScore: number;
  screeningRank: number;
  voltageFit: VoltageFit;
  confidence: CandidateConfidence;
  missingEvidence: string[];
  constraints: string[];
  calculationVersion: string;
  source: "database" | "published_artifact";
};

export type RankedCandidateResult = {
  requiredImportMw: number;
  maxDistanceKm: number;
  calculationVersion: string;
  evidenceBoundary: string;
  candidates: CandidateOpportunity[];
};

export type DatabaseRankedCandidate = {
  site_id: string;
  node_id: string;
  site_name: string;
  node_name: string;
  operator_name: string | null;
  voltage_kv: number[] | null;
  straight_line_distance_km: number | string;
  context_score: number;
  evidence_score: number;
  missing_evidence: string[];
  project_voltage_fit: VoltageFit;
  screening_rank: number | string;
};

const evidenceWeights: Record<PowerFinderEvidenceClass, number> = {
  official_operator: 80,
  official_regulatory: 70,
  official_public: 60,
  open_mapping: 35,
  test_fixture: 10,
};

export const candidateEvidenceBoundary =
  "Ranks proximity, voltage context, and evidence completeness. It does not estimate available capacity, connection probability, cost, or delivery date.";

export function requiredVoltageFit(requiredImportMw: number, voltageKv: number[]): VoltageFit {
  const maximum = Math.max(0, ...voltageKv);
  if (maximum === 0) return "unknown";
  if (requiredImportMw >= 100 && maximum < 220) return "conditional";
  if (requiredImportMw >= 20 && maximum < 110) return "conditional";
  return "compatible";
}

export function parseDatabaseRanking(
  value: unknown,
  requiredImportMw: number,
  maxDistanceKm: number,
): RankedCandidateResult {
  if (!value || typeof value !== "object") throw new Error("Candidate ranking is missing.");
  const record = value as {
    calculation_version?: unknown;
    evidence_boundary?: unknown;
    candidates?: unknown;
  };
  if (!Array.isArray(record.candidates)) throw new Error("Candidate ranking is invalid.");
  const candidates = record.candidates.map((item) => {
    const row = item as DatabaseRankedCandidate;
    const distanceKm = Number(row.straight_line_distance_km);
    const screeningRank = Number(row.screening_rank);
    if (
      !row.site_id ||
      !row.node_id ||
      !row.site_name ||
      !row.node_name ||
      !Number.isFinite(distanceKm) ||
      !Number.isFinite(screeningRank)
    ) {
      throw new Error("Candidate ranking contains an invalid record.");
    }
    return createOpportunity({
      id: `${row.site_id}:${row.node_id}`,
      siteId: row.site_id,
      nodeId: row.node_id,
      siteName: row.site_name,
      nodeName: row.node_name,
      operator: row.operator_name,
      voltageKv: row.voltage_kv ?? [],
      distanceKm,
      contextScore: row.context_score,
      evidenceScore: row.evidence_score,
      screeningRank,
      voltageFit: row.project_voltage_fit,
      missingEvidence: row.missing_evidence ?? [],
      calculationVersion: String(record.calculation_version ?? "site-node-context-v1"),
      source: "database",
    });
  });
  return {
    requiredImportMw,
    maxDistanceKm,
    calculationVersion: String(record.calculation_version ?? "site-node-context-v1"),
    evidenceBoundary: String(record.evidence_boundary ?? candidateEvidenceBoundary),
    candidates,
  };
}

export function rankPublishedCandidates(
  collection: PowerFinderCollection,
  requiredImportMw: number,
  maxDistanceKm: number,
  resultLimit = 25,
): RankedCandidateResult {
  const sites = collection.features.filter(
    (feature) => feature.properties.kind === "industrial_site",
  );
  const nodes = collection.features.filter((feature) => feature.properties.kind === "node");
  const candidates: CandidateOpportunity[] = [];

  for (const site of sites) {
    const sitePosition = geometryCentre(site.geometry);
    if (!sitePosition) continue;
    for (const node of nodes) {
      const nodePosition = geometryCentre(node.geometry);
      if (!nodePosition) continue;
      const distanceKm = haversineKm(sitePosition, nodePosition);
      if (distanceKm > maxDistanceKm) continue;
      const score = scoreFeature(node);
      const contextScore = score?.total ?? 0;
      const evidenceScore = evidenceWeights[node.properties.evidence_class];
      const distanceScore = Math.max(0, 100 - distanceKm * 5);
      const screeningRank = round1(
        contextScore * 0.45 + evidenceScore * 0.35 + distanceScore * 0.2,
      );
      const voltageFit = requiredVoltageFit(requiredImportMw, node.properties.voltage_kv ?? []);
      const missingEvidence = [
        ...(node.properties.voltage_kv?.length ? [] : ["voltage"]),
        ...(node.properties.operator ? [] : ["responsible operator"]),
        "available demand capacity",
        "connection feasibility",
        "delivery date",
      ];
      candidates.push(
        createOpportunity({
          id: `${site.id}:${node.id}`,
          siteId: site.id,
          nodeId: node.id,
          siteName: site.properties.name,
          nodeName: node.properties.name,
          operator: node.properties.operator ?? null,
          voltageKv: node.properties.voltage_kv ?? [],
          distanceKm: round1(distanceKm),
          contextScore,
          evidenceScore,
          screeningRank,
          voltageFit,
          missingEvidence,
          calculationVersion: "artifact-site-node-context-v1",
          source: "published_artifact",
        }),
      );
    }
  }

  return {
    requiredImportMw,
    maxDistanceKm,
    calculationVersion: "artifact-site-node-context-v1",
    evidenceBoundary: candidateEvidenceBoundary,
    candidates: candidates
      .sort(
        (left, right) =>
          right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
      )
      .slice(0, resultLimit),
  };
}

function createOpportunity(
  value: Omit<CandidateOpportunity, "confidence" | "constraints">,
): CandidateOpportunity {
  const constraints = [
    ...(value.voltageFit === "conditional"
      ? ["Mapped voltage is below the indicative level for this load."]
      : value.voltageFit === "unknown"
        ? ["Voltage compatibility is not established."]
        : []),
    ...(value.operator ? [] : ["Responsible network operator requires confirmation."]),
    ...(value.missingEvidence.includes("available demand capacity")
      ? ["No published demand-capacity evidence is attached."]
      : []),
  ];
  const confidence: CandidateConfidence =
    value.evidenceScore >= 70 && value.missingEvidence.length <= 2
      ? "high"
      : value.evidenceScore >= 35 && value.missingEvidence.length <= 5
        ? "medium"
        : "low";
  return { ...value, confidence, constraints };
}

function geometryCentre(geometry: Geometry): Position | null {
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "GeometryCollection") {
    const centres = geometry.geometries
      .map(geometryCentre)
      .filter((position): position is Position => Boolean(position));
    if (!centres.length) return null;
    return [
      centres.reduce((sum, position) => sum + position[0], 0) / centres.length,
      centres.reduce((sum, position) => sum + position[1], 0) / centres.length,
    ];
  }
  const positions = flattenPositions(geometry.coordinates);
  if (!positions.length) return null;
  return [
    positions.reduce((sum, position) => sum + position[0], 0) / positions.length,
    positions.reduce((sum, position) => sum + position[1], 0) / positions.length,
  ];
}

function flattenPositions(value: unknown): Position[] {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [value as Position];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap(flattenPositions);
}

function haversineKm(left: Position, right: Position) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right[1] - left[1]);
  const longitudeDelta = radians(right[0] - left[0]);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left[1])) * Math.cos(radians(right[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function opportunityNode(
  opportunity: CandidateOpportunity,
  collection: PowerFinderCollection | null,
): PowerFinderFeature | null {
  return (
    collection?.features.find(
      (feature) => feature.properties.kind === "node" && String(feature.id) === opportunity.nodeId,
    ) ?? null
  );
}
