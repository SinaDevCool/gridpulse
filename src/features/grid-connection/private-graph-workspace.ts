import { supabase } from "../../integrations/supabase/client";

export type PrivateGraphState =
  | "no_workspace"
  | "no_model"
  | "model_accepted"
  | "physics_verified"
  | "stale";

export type GraphPathway = {
  rank: number;
  target_bus: string;
  bus_ids: string[];
  asset_ids: string[];
  total_graph_cost: number;
};

export type PrivateGraphWorkspace = {
  schema_version: string;
  state: PrivateGraphState;
  site_id: string;
  workspace?: {
    id: string;
    status: string;
    validation_class: string;
    real_operator_pilot: boolean;
  };
  model?: {
    model_id: string;
    model_version: string;
    projection_sha256: string;
    study_sha256: string;
    status: string;
    created_at: string;
    capacity_claim: false;
  };
  topology_audit?: Record<string, unknown>;
  pathways?: {
    source_bus?: string;
    algorithm?: string;
    pathways?: GraphPathway[];
    capacity_claim?: false;
  };
  scenario_coverage?: Record<string, unknown>;
  physics?: Array<Record<string, unknown>>;
  history?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  deltas?: Array<Record<string, unknown>>;
  quality?: Record<string, unknown>;
  portfolio?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  prohibited_interpretations?: string[];
  capacity_claim: false;
};

export type CandidateModelBusLink = {
  id: string;
  site_id: string;
  workspace_id: string;
  public_candidate_id: string;
  public_node_id: string | null;
  model_id: string;
  model_version: string;
  operator_bus_id: string;
  match_method: "manual" | "identifier" | "assisted_geographic" | "operator_supplied";
  match_status: "suggested" | "under_review" | "accepted" | "rejected" | "superseded";
  distance_m: number | null;
  voltage_match: boolean | null;
  operator_match: boolean | null;
  evidence_reference: string | null;
  review_note: string | null;
  reviewed_at: string | null;
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const pathway = (value: unknown): GraphPathway | null => {
  const row = object(value);
  if (typeof row.rank !== "number" || typeof row.target_bus !== "string") return null;
  return {
    rank: row.rank,
    target_bus: row.target_bus,
    bus_ids: strings(row.bus_ids),
    asset_ids: strings(row.asset_ids),
    total_graph_cost: typeof row.total_graph_cost === "number" ? row.total_graph_cost : 0,
  };
};

export function parsePrivateGraphWorkspace(value: unknown): PrivateGraphWorkspace {
  const row = object(value);
  const allowedStates: PrivateGraphState[] = [
    "no_workspace",
    "no_model",
    "model_accepted",
    "physics_verified",
    "stale",
  ];
  const state = allowedStates.includes(row.state as PrivateGraphState)
    ? (row.state as PrivateGraphState)
    : "no_model";
  const rawPathways = object(row.pathways);
  const model = object(row.model);
  const workspace = object(row.workspace);
  return {
    schema_version:
      typeof row.schema_version === "string" ? row.schema_version : "gridpulse-private-graph-ui-v1",
    state,
    site_id: typeof row.site_id === "string" ? row.site_id : "",
    workspace: Object.keys(workspace).length
      ? {
          id: String(workspace.id ?? ""),
          status: String(workspace.status ?? "unknown"),
          validation_class: String(workspace.validation_class ?? "operator_model_unvalidated"),
          real_operator_pilot: workspace.real_operator_pilot === true,
        }
      : undefined,
    model: Object.keys(model).length
      ? {
          model_id: String(model.model_id ?? ""),
          model_version: String(model.model_version ?? ""),
          projection_sha256: String(model.projection_sha256 ?? ""),
          study_sha256: String(model.study_sha256 ?? ""),
          status: String(model.status ?? "unknown"),
          created_at: String(model.created_at ?? ""),
          capacity_claim: false,
        }
      : undefined,
    topology_audit: object(row.topology_audit),
    pathways: Object.keys(rawPathways).length
      ? {
          source_bus:
            typeof rawPathways.source_bus === "string" ? rawPathways.source_bus : undefined,
          algorithm: typeof rawPathways.algorithm === "string" ? rawPathways.algorithm : undefined,
          pathways: Array.isArray(rawPathways.pathways)
            ? rawPathways.pathways
                .map(pathway)
                .filter((item): item is GraphPathway => Boolean(item))
            : [],
          capacity_claim: false,
        }
      : undefined,
    scenario_coverage: object(row.scenario_coverage),
    physics: Array.isArray(row.physics) ? row.physics.map(object) : [],
    history: Array.isArray(row.history) ? row.history.map(object) : [],
    events: Array.isArray(row.events) ? row.events.map(object) : [],
    deltas: Array.isArray(row.deltas) ? row.deltas.map(object) : [],
    quality: object(row.quality),
    portfolio: object(row.portfolio),
    policy: object(row.policy),
    prohibited_interpretations: strings(row.prohibited_interpretations),
    capacity_claim: false,
  };
}

export async function loadPrivateGraphWorkspace(siteId: string) {
  const { data, error } = await supabase.rpc("private_graph_workspace_ui", {
    p_site_id: siteId,
  });
  if (error) throw error;
  return parsePrivateGraphWorkspace(data);
}

export async function loadCandidateModelBusLinks(siteId: string) {
  const { data, error } = await supabase
    .from("grid_candidate_model_bus_links")
    .select("id,site_id,workspace_id,public_candidate_id,public_node_id,model_id,model_version,operator_bus_id,match_method,match_status,distance_m,voltage_match,operator_match,evidence_reference,review_note,reviewed_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CandidateModelBusLink[];
}

export async function acceptCandidateModelBusLink(linkId: string, reviewNote: string) {
  const { data, error } = await supabase.rpc("accept_candidate_model_bus_link", {
    p_link_id: linkId,
    p_review_note: reviewNote || null,
  });
  if (error) throw error;
  return data as CandidateModelBusLink;
}

export const privateGraphStateLabels: Record<PrivateGraphState, string> = {
  no_workspace: "No operator workspace",
  no_model: "No accepted graph model",
  model_accepted: "Topology model accepted",
  physics_verified: "Physics results verified",
  stale: "Results require recalculation",
};

export const graphSafetyBoundary =
  "Topology pathways prioritise investigation. They do not establish available capacity, connection probability, cost or delivery date.";
