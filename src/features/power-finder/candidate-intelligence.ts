import type { Geometry, Position } from "geojson";
import type {
  PowerFinderCollection,
  PowerFinderEvidenceClass,
  PowerFinderFeature,
} from "./fixture-data";
import { scoreFeature } from "./screening-score";
import type { CapacityScenarioResult } from "./capacity-scenario";
import type { ReleaseBNetworkResult } from "./release-b-network";
import { publicScreeningProvenance, type CalculationProvenance } from "./calculation-provenance";
import {
  baseRankingWeights,
  projectRankingProfiles,
  RANKING_MODEL_VERSION,
  weightedInvestigationPriority,
  type RankingWeights,
} from "./ranking-config";
import type { FinderProjectType } from "./finder-project";

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
  rankComponents?: {
    evidenceReadiness: number;
    mappedVoltageRelevance: number;
    proximity: number;
    operatorAttribution: number;
    sourceFreshness: number;
  };
  provenance?: CalculationProvenance;
  sourcePublishedAt?: string | null;
  missingEvidence: string[];
  constraints: string[];
  calculationVersion: string;
  source: "database" | "published_artifact";
  capacityScenario?: CapacityScenarioResult;
  networkScenario?: ReleaseBNetworkResult;
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
  "Investigation priority ranks public-source evidence, mapped-voltage relevance, proximity, operator attribution and source freshness. It does not establish technical compatibility, available capacity, connection probability, cost, or delivery date.";

export const voltageFitLabels: Record<VoltageFit, string> = {
  compatible: "mapped voltage matches selected search context",
  conditional: "mapped voltage differs from selected search context",
  unknown: "mapped voltage unknown",
};

export function highestRankedOpportunityForNode(
  candidates: CandidateOpportunity[],
  nodeId: string,
) {
  return candidates
    .filter((candidate) => candidate.nodeId === nodeId)
    .sort(
      (left, right) =>
        right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
    )[0];
}

export function mappedVoltageRelevance(
  preferredVoltageKv: number | null,
  voltageKv: number[],
): VoltageFit {
  const maximum = Math.max(0, ...voltageKv);
  if (maximum === 0) return "unknown";
  if (preferredVoltageKv && !voltageKv.includes(preferredVoltageKv)) return "conditional";
  return "compatible";
}

export const requiredVoltageFit = (_requiredImportMw: number, voltageKv: number[]) =>
  mappedVoltageRelevance(null, voltageKv);

export function applyPreferredVoltageContext(
  candidates: CandidateOpportunity[],
  preferredVoltageKv: number | null,
  projectType?: FinderProjectType,
) {
  const weights: RankingWeights = projectType
    ? projectRankingProfiles[projectType]
    : baseRankingWeights;
  return candidates
    .map((candidate) => {
      const voltageFit = mappedVoltageRelevance(preferredVoltageKv, candidate.voltageKv);
      const components = candidate.rankComponents;
      if (!components) return { ...candidate, voltageFit };
      const mappedVoltageRelevanceScore =
        voltageFit === "compatible" ? 100 : voltageFit === "conditional" ? 55 : 30;
      const rankComponents = {
        ...components,
        mappedVoltageRelevance: mappedVoltageRelevanceScore,
      };
      const screeningRank = round1(weightedInvestigationPriority(rankComponents, weights));
      return { ...candidate, voltageFit, rankComponents, screeningRank };
    })
    .sort(
      (left, right) =>
        right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
    );
}

function investigationPriority(input: {
  evidenceReadiness: number;
  voltageKnown: boolean;
  distanceKm: number;
  operatorKnown: boolean;
  publishedAt?: string | null;
}) {
  const rankComponents = {
    evidenceReadiness: round1(input.evidenceReadiness),
    mappedVoltageRelevance: input.voltageKnown ? 100 : 30,
    proximity: round1(100 / (1 + input.distanceKm / 10)),
    operatorAttribution: input.operatorKnown ? 100 : 40,
    sourceFreshness: sourceFreshnessScore(input.publishedAt),
  };
  const score = round1(weightedInvestigationPriority(rankComponents));
  return { score, rankComponents };
}

export function sourceFreshnessScore(publishedAt?: string | null, now = new Date()): number {
  if (!publishedAt) return 30;
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return 30;
  const ageDays = Math.max(0, (now.getTime() - published.getTime()) / 86_400_000);
  if (ageDays <= 31) return 100;
  if (ageDays <= 93) return 85;
  if (ageDays <= 183) return 70;
  if (ageDays <= 366) return 55;
  if (ageDays <= 730) return 40;
  return 25;
}

function usableVoltage(feature: PowerFinderFeature) {
  const values = ["ambiguous", "implausible"].includes(
    feature.properties.voltage_evidence_status ?? "accepted",
  )
    ? []
    : (feature.properties.voltage_kv ?? []);
  return values.filter((voltage) => Number.isFinite(voltage) && voltage > 0 && voltage <= 500);
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
      voltageKv: (row.voltage_kv ?? []).filter(
        (voltage) => Number.isFinite(voltage) && voltage > 0 && voltage <= 500,
      ),
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
      const voltageValues = usableVoltage(node);
      const voltageFit = requiredVoltageFit(requiredImportMw, voltageValues);
      const missingEvidence = [
        ...(voltageValues.length ? [] : ["voltage"]),
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
          voltageKv: voltageValues,
          distanceKm: round1(distanceKm),
          contextScore,
          evidenceScore,
          screeningRank,
          voltageFit,
          missingEvidence,
          calculationVersion: RANKING_MODEL_VERSION,
          source: "published_artifact",
          sourcePublishedAt:
            node.properties.source_published_at ?? collection.metadata.published_at,
        }),
      );
    }
  }

  return {
    requiredImportMw,
    maxDistanceKm,
    calculationVersion: RANKING_MODEL_VERSION,
    evidenceBoundary: candidateEvidenceBoundary,
    candidates: candidates
      .sort(
        (left, right) =>
          right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
      )
      .slice(0, resultLimit),
  };
}

export function rankCandidatesForLocation(
  collection: PowerFinderCollection,
  longitude: number,
  latitude: number,
  requiredImportMw: number,
  maxDistanceKm: number,
  siteName = "Custom project site",
  resultLimit = 25,
): RankedCandidateResult {
  const sitePosition: Position = [longitude, latitude];
  const candidates = collection.features
    .filter((feature) => feature.properties.kind === "node")
    .flatMap((node) => {
      const nodePosition = geometryCentre(node.geometry);
      if (!nodePosition) return [];
      const distanceKm = haversineKm(sitePosition, nodePosition);
      if (distanceKm > maxDistanceKm) return [];
      const score = scoreFeature(node);
      const contextScore = score?.total ?? 0;
      const evidenceScore = evidenceWeights[node.properties.evidence_class];
      const distanceScore = Math.max(0, 100 - distanceKm * 5);
      const voltageValues = usableVoltage(node);
      const voltageFit = requiredVoltageFit(requiredImportMw, voltageValues);
      const missingEvidence = [
        ...(voltageValues.length ? [] : ["voltage"]),
        ...(node.properties.operator ? [] : ["responsible operator"]),
        "available import capacity",
        "available export capacity",
        "connection feasibility",
        "connection cost",
        "delivery date",
      ];
      return [
        createOpportunity({
          id: `custom:${node.id}`,
          siteId: "custom-site",
          nodeId: String(node.id),
          siteName,
          nodeName: node.properties.name,
          operator: node.properties.operator ?? null,
          voltageKv: voltageValues,
          distanceKm: round1(distanceKm),
          contextScore,
          evidenceScore,
          screeningRank: round1(contextScore * 0.45 + evidenceScore * 0.35 + distanceScore * 0.2),
          voltageFit,
          missingEvidence,
          calculationVersion: RANKING_MODEL_VERSION,
          source: "published_artifact",
          sourcePublishedAt:
            node.properties.source_published_at ?? collection.metadata.published_at,
        }),
      ];
    })
    .sort(
      (left, right) =>
        right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
    )
    .slice(0, resultLimit);

  return {
    requiredImportMw,
    maxDistanceKm,
    calculationVersion: RANKING_MODEL_VERSION,
    evidenceBoundary: candidateEvidenceBoundary,
    candidates,
  };
}

function createOpportunity(
  value: Omit<CandidateOpportunity, "confidence" | "constraints">,
): CandidateOpportunity {
  const constraints = [
    ...(value.voltageFit === "conditional"
      ? ["Mapped voltage differs from the selected search context."]
      : value.voltageFit === "unknown"
        ? ["Mapped voltage is not established."]
        : []),
    ...(value.operator ? [] : ["Responsible network operator requires confirmation."]),
    ...(value.missingEvidence.includes("available demand capacity")
      ? ["No published demand-capacity evidence is attached."]
      : []),
    "Mapped voltage alone does not establish a viable connection.",
    ...(/bahn|rail|gleichrichter|unterwerk/i.test(`${value.nodeName} ${value.operator ?? ""}`)
      ? [
          "This appears to be specialised or railway infrastructure; public-grid suitability requires confirmation.",
        ]
      : []),
  ];
  const confidence: CandidateConfidence =
    value.evidenceScore >= 70 && value.missingEvidence.length <= 2
      ? "high"
      : value.evidenceScore >= 35 && value.missingEvidence.length <= 5
        ? "medium"
        : "low";
  const priority = investigationPriority({
    evidenceReadiness: value.contextScore,
    voltageKnown: value.voltageKv.length > 0,
    distanceKm: value.distanceKm,
    operatorKnown: Boolean(value.operator),
    publishedAt: value.sourcePublishedAt,
  });
  return {
    ...value,
    screeningRank: priority.score,
    rankComponents: priority.rankComponents,
    provenance: publicScreeningProvenance([value.nodeId, value.siteId]),
    confidence,
    constraints,
  };
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
