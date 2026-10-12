import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (
  (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) &&
  existsSync(".env.local")
) {
  loadEnvFile(".env.local");
}

const baseUrl = process.env.PUBLIC_FINDER_BASE_URL ?? "https://gridpulseinsights.com";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.");
}

const viewport = new URL("/api/power-finder/viewport", baseUrl);
viewport.search = new URLSearchParams({
  west: "12.9",
  south: "52.1",
  east: "13.8",
  north: "52.7",
  generation: "true",
  storage: "true",
}).toString();

const publicResponse = await fetch(viewport);
if (!publicResponse.ok) throw new Error(`Public viewport returned ${publicResponse.status}.`);
const collection = await publicResponse.json();
const kinds = new Set(collection.features?.map((feature) => feature.properties?.kind));
const availableKinds = new Set(collection.metadata?.available_kinds ?? []);
if (!["node", "line", "industrial_site"].every((kind) => availableKinds.has(kind))) {
  throw new Error("Public viewport is missing required topology layers.");
}
if (
  collection.metadata?.coverage_status !== "accepted_static_fallback" &&
  (!availableKinds.has("generation_asset") || !availableKinds.has("storage_asset"))
) {
  throw new Error("Live public viewport does not advertise registered generation and storage.");
}

const scenarioResponse = await fetch(new URL("/api/power-finder/scenario", baseUrl), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    project: {
      name: "Security check",
      type: "industrial_load",
      importMw: 20,
      ultimateImportMw: 20,
      exportMw: 0,
      minimumFirmMw: 15,
      flexibleLoadMw: 5,
      targetEnergisationYear: 2030,
      preferredVoltageKv: 110,
      redundancy: "single_feed",
      loadProfile: "flat",
      annualConsumptionGwh: 100,
      maxInterruptionHours: 2,
      annualInterruptionLimit: 10,
      batteryPowerMw: 0,
      batteryEnergyMwh: 0,
      batteryRoundTripEfficiencyPct: 88,
      batteryReservePct: 10,
      onsiteGenerationMw: 0,
    },
    candidates: [
      {
        id: "security-candidate",
        nodeId: "security-node",
        voltageKv: [110],
        distanceKm: 2,
        contextScore: 70,
        evidenceScore: 60,
      },
    ],
  }),
});
if (![200, 404].includes(scenarioResponse.status)) {
  throw new Error(`Public scenario endpoint returned ${scenarioResponse.status}.`);
}
if (scenarioResponse.ok) {
  const scenarioPayload = await scenarioResponse.json();
  if (
    scenarioResponse.headers.get("x-gridpulse-evidence-status") !== "synthetic" ||
    scenarioPayload.notForConnectionDecision !== true ||
    scenarioPayload.validationStatus !== "unvalidated_reference_model" ||
    scenarioPayload.scenarios?.[0]?.networkScenario?.validationStatus !==
      "unvalidated_reference_model"
  ) {
    throw new Error("Public scenario endpoint is missing its synthetic safety boundary.");
  }
}

const headers = { apikey: publishableKey };
if (publishableKey.startsWith("eyJ")) headers.authorization = `Bearer ${publishableKey}`;
const protectedTable = await fetch(
  `${supabaseUrl}/rest/v1/canonical_energy_assets?select=id&limit=1`,
  {
    headers,
  },
);
if (![401, 403].includes(protectedTable.status)) {
  throw new Error(
    `Anonymous canonical-table access unexpectedly returned ${protectedTable.status}.`,
  );
}
const release2Tables = [
  "grid_surrogate_artifacts",
  "grid_active_learning_candidates",
  "grid_rare_event_results",
  "grid_model_promotion_decisions",
];
const release3Tables = [
  "grid_shadow_validation_runs",
  "grid_shadow_observations",
  "grid_champion_history",
];
const release5Tables = [
  "integration_events",
  "assessment_reviews",
  "operations_simulations",
  "pilot_metrics",
  "fca_envelopes",
  "operator_engagements",
  "operator_engagement_events",
];
const graphTables = [
  "grid_graph_projections",
  "grid_topology_studies",
  "grid_cgmes_imports",
  "grid_topology_states",
  "grid_graph_algorithm_runs",
  "grid_graph_state_spaces",
  "grid_graph_reduction_validations",
  "grid_graph_portfolio_interactions",
  "grid_graph_study_bundles",
  "grid_graph_physics_compilations",
  "grid_graph_contingency_plans",
  "grid_graph_physics_attachments",
  "grid_graph_operator_promotions",
  "grid_graph_temporal_snapshots",
  "grid_graph_topology_events",
  "grid_graph_projection_deltas",
  "grid_graph_quality_runs",
  "grid_graph_workspace_policies",
  "grid_candidate_model_bus_links",
  "network_capacity_study_runs",
  "node_capacity_results",
  "capacity_result_constraints",
];
const release2Statuses = {};
for (const table of release2Tables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers });
  release2Statuses[table] = response.status;
  if (![401, 403].includes(response.status)) {
    throw new Error(`Anonymous Release 2 table ${table} returned ${response.status}.`);
  }
}
const release3Statuses = {};
for (const table of release3Tables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers });
  release3Statuses[table] = response.status;
  if (![401, 403].includes(response.status)) {
    throw new Error(`Anonymous Release 3 table ${table} returned ${response.status}.`);
  }
}
const release5Statuses = {};
for (const table of release5Tables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers });
  release5Statuses[table] = response.status;
  if ([401, 403].includes(response.status)) continue;
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length === 0) continue;
  }
  throw new Error(
    `Anonymous Release 5 table ${table} exposed data or returned ${response.status}.`,
  );
}
const graphTableStatuses = {};
for (const table of graphTables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers });
  graphTableStatuses[table] = response.status;
  if (![401, 403].includes(response.status)) {
    throw new Error(`Anonymous graph table ${table} returned ${response.status}.`);
  }
}
const privateGraphUi = await fetch(`${supabaseUrl}/rest/v1/rpc/private_graph_workspace_ui`, {
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify({ p_site_id: "00000000-0000-0000-0000-000000000000" }),
});
if (![401, 403].includes(privateGraphUi.status)) {
  throw new Error(`Anonymous private graph UI access returned ${privateGraphUi.status}.`);
}
const acceptCandidateLink = await fetch(
  `${supabaseUrl}/rest/v1/rpc/accept_candidate_model_bus_link`,
  {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      p_link_id: "00000000-0000-0000-0000-000000000000",
      p_review_note: "anonymous security probe",
    }),
  },
);
if (![401, 403, 404].includes(acceptCandidateLink.status)) {
  throw new Error(
    `Anonymous candidate-model reconciliation returned ${acceptCandidateLink.status}.`,
  );
}

const invalid = await fetch(
  `${baseUrl}/api/power-finder/viewport?west=-20&south=0&east=20&north=60`,
);
if (invalid.status !== 400) throw new Error(`Invalid viewport returned ${invalid.status}.`);

console.log(
  JSON.stringify({
    status: "pass",
    record_count: collection.metadata.record_count,
    kinds: [...kinds].sort(),
    protected_table_status: protectedTable.status,
    release2_table_statuses: release2Statuses,
    release3_table_statuses: release3Statuses,
    release5_table_statuses: release5Statuses,
    graph_table_statuses: graphTableStatuses,
    private_graph_ui_status: privateGraphUi.status,
    candidate_model_reconciliation_status: acceptCandidateLink.status,
    invalid_viewport_status: invalid.status,
    scenario_status: scenarioResponse.status,
  }),
);
