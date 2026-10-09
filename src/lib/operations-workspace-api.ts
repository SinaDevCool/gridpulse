import {
  operationsWorkspaceSchema,
  type OperationsWorkspace,
} from "../features/operations/workspace-contract";
import { operationsMetricSchema } from "./operations-ingest-api";
import { operationsFingerprint } from "./operations-request";

export type OperationsWorkspaceEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

const response = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });

export async function handleOperationsWorkspace(request: Request, env: OperationsWorkspaceEnv) {
  if (request.method !== "GET") return response({ error: "Method not allowed." }, 405);
  const url = new URL(request.url);
  const facilityId = url.searchParams.get("facilityId") ?? "";
  const generatedAt = new Date().toISOString();
  const end = url.searchParams.get("end") ?? generatedAt;
  if (!Number.isFinite(Date.parse(end)))
    return response({ error: "A valid evidence-window end timestamp is required." }, 400);
  const start =
    url.searchParams.get("start") ?? new Date(Date.parse(end) - 86_400_000).toISOString();
  if (
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(start) >= Date.parse(end) ||
    Date.parse(end) > Date.parse(generatedAt) ||
    Date.parse(end) - Date.parse(start) > 7 * 86_400_000
  )
    return response(
      { error: "An evidence window of up to seven days, ending no later than now, is required." },
      400,
    );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(facilityId)
  )
    return response({ error: "A valid facilityId is required." }, 400);

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return response({ error: "Authentication required." }, 401);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const apiKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !apiKey)
    return response({ error: "Operations persistence is not configured." }, 503);

  const headers = { apikey: apiKey, authorization, accept: "application/json" };
  const query = async (table: string, parameters: string) => {
    const result = await fetch(`${supabaseUrl}/rest/v1/${table}?${parameters}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) throw new Error(`${table}:${result.status}`);
    const rows: unknown = await result.json();
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
    )
      throw new Error("Invalid persistence response");
    return rows as Array<Record<string, unknown>>;
  };
  const facilityFilter = `facility_id=eq.${encodeURIComponent(facilityId)}`;
  const readMeasurements = async () => {
    const pages = await Promise.all(
      operationsMetricSchema.options.map(async (metric) => {
        const rows: Array<Record<string, unknown>> = [];
        for (let page = 0; page < 4; page++) {
          const next = await query(
            "operations_measurements",
            `${facilityFilter}&metric_key=eq.${metric}&select=source_id,metric_key,asset_id,event_at,received_at,interval_seconds,value,unit,value_kind,quality&quality=eq.accepted&event_at=gte.${encodeURIComponent(start)}&event_at=lte.${encodeURIComponent(end)}&received_at=lte.${encodeURIComponent(end)}&order=event_at.asc,id.asc&limit=1000&offset=${page * 1000}`,
          );
          rows.push(...next);
          if (next.length < 1000) return rows;
        }
        throw new Error("Evidence window exceeds the safe page bound; shorten the window.");
      }),
    );
    return pages.flat().sort((a, b) => String(a.event_at).localeCompare(String(b.event_at)));
  };

  try {
    const facilities = await query(
      "operations_facilities",
      `id=eq.${facilityId}&select=id,name,timezone,contracted_import_limit_mw,limit_evidence,limit_valid_to&limit=1`,
    );
    const facility = facilities[0];
    if (!facility) return response({ error: "Facility not found." }, 404);

    const [
      sources,
      watermarks,
      measurements,
      batteries,
      workloads,
      forecasts,
      recommendations,
      verifications,
      quality,
      agreements,
      calculationRuns,
      approvals,
    ] = await Promise.all([
      query(
        "operations_sources",
        `${facilityFilter}&select=id,source_type,display_name,health,read_only,last_received_at,expected_interval_seconds&order=display_name.asc`,
      ),
      query(
        "operations_source_watermarks",
        `${facilityFilter}&select=source_id,latest_event_at,latest_received_at,consecutive_failures,last_error_code`,
      ),
      readMeasurements(),
      query("operations_battery_assets", `${facilityFilter}&select=*&order=created_at.asc`),
      query("operations_workloads", `${facilityFilter}&select=*&order=updated_at.desc&limit=500`),
      query(
        "operations_forecasts",
        `${facilityFilter}&select=*&promotion_status=eq.accepted&generated_at=lte.${encodeURIComponent(end)}&evidence_cutoff=lte.${encodeURIComponent(end)}&order=generated_at.desc&limit=1`,
      ),
      query(
        "operations_recommendations",
        `${facilityFilter}&select=*&order=created_at.desc&limit=1`,
      ),
      query("operations_verifications", `${facilityFilter}&select=*&order=created_at.desc&limit=1`),
      query("operations_data_quality", `${facilityFilter}&select=*&order=window_end.desc&limit=1`),
      query(
        "operations_operating_agreements",
        `${facilityFilter}&select=*&order=valid_from.desc&limit=10`,
      ),
      query(
        "operations_calculation_runs",
        `${facilityFilter}&select=*&order=created_at.desc&limit=10`,
      ),
      query(
        "operations_dispatch_approvals",
        `${facilityFilter}&select=*&order=decision_at.desc&limit=50`,
      ),
    ]);

    const watermarkBySource = new Map(watermarks.map((item) => [item.source_id, item]));
    const freshestEvidenceAt = measurements
      .filter((item) => item.metric_key === "facility_grid_import_mw")
      .reduce<string | null>((latest, item) => {
        const value = String(item.event_at);
        return !latest || value > latest ? value : latest;
      }, null);
    const blockers: string[] = [];
    if (!measurements.length) blockers.push("No accepted facility measurements are available.");
    if (!sources.some((item) => item.source_type === "facility_meter" && item.health === "healthy"))
      blockers.push("No healthy facility-meter source is connected.");
    if (!forecasts.length) blockers.push("No promoted facility forecast is available.");
    if (!recommendations.length) blockers.push("No canonical recommendation is available.");
    for (const source of sources.filter((item) => item.source_type === "facility_meter")) {
      const latest = measurements
        .filter(
          (item) => item.source_id === source.id && item.metric_key === "facility_grid_import_mw",
        )
        .at(-1);
      const tolerance = Math.max(Number(source.expected_interval_seconds ?? 300) * 3, 300) * 1000;
      if (!latest || Date.parse(end) - Date.parse(String(latest.event_at)) > tolerance)
        blockers.push(
          `Facility-meter evidence is stale or missing for ${String(source.display_name)}.`,
        );
    }

    const workspace: OperationsWorkspace = operationsWorkspaceSchema.parse({
      schemaVersion: "gridpulse-operations-workspace-v1",
      generatedAt,
      evidenceWindow: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
      automaticDispatchAuthorized: false,
      facility: {
        id: facility.id,
        name: facility.name,
        timezone: facility.timezone,
        contractedImportLimitMw: Number(facility.contracted_import_limit_mw),
        limitEvidence: facility.limit_evidence,
        limitValidUntil: facility.limit_valid_to,
      },
      sources: sources.map((item) => {
        const watermark = watermarkBySource.get(item.id) ?? {};
        return {
          id: item.id,
          type: item.source_type,
          name: item.display_name,
          health: item.health,
          readOnly: item.read_only,
          lastReceivedAt: item.last_received_at,
          latestEventAt: watermark.latest_event_at ?? null,
          consecutiveFailures: Number(watermark.consecutive_failures ?? 0),
          lastErrorCode: watermark.last_error_code ?? null,
        };
      }),
      measurements: measurements.map((item) => ({
        metricKey: item.metric_key,
        assetId: item.asset_id,
        eventAt: item.event_at,
        receivedAt: item.received_at,
        intervalSeconds: item.interval_seconds ?? null,
        value: Number(item.value),
        unit: item.unit,
        valueKind: item.value_kind,
        quality: item.quality,
        sourceId: item.source_id,
      })),
      batteryAssets: batteries,
      workloads,
      latestForecast: forecasts[0] ?? null,
      latestRecommendation: recommendations[0] ?? null,
      latestVerification: verifications[0] ?? null,
      dataQuality: quality[0] ?? null,
      operatingAgreements: agreements,
      calculationRuns,
      dispatchApprovals: approvals,
      readiness: {
        mode: recommendations.length ? "shadow" : measurements.length ? "historical" : "historical",
        blockers,
        freshestEvidenceAt,
      },
    });
    workspace.inputFingerprint = await operationsFingerprint({
      facility: workspace.facility,
      evidenceWindow: workspace.evidenceWindow,
      sources: workspace.sources,
      measurements: workspace.measurements,
      batteryAssets: workspace.batteryAssets,
      workloads: workspace.workloads,
      latestForecast: workspace.latestForecast,
      operatingAgreements: workspace.operatingAgreements,
    });
    return response(workspace, 200);
  } catch {
    return response({ error: "The Operations workspace could not be loaded." }, 502);
  }
}
