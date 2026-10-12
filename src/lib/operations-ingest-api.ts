import { z } from "zod";
import { OperationsPayloadError, readOperationsJson, sha256 } from "./operations-request";

export type OperationsIngestEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OPERATIONS_INGEST_TOKEN?: string;
};

export const operationsMetricSchema = z.enum([
  "facility_grid_import_mw",
  "it_load_mw",
  "gpu_power_mw",
  "gpu_utilization_percent",
  "cooling_power_mw",
  "auxiliary_power_mw",
  "ups_output_mw",
  "bess_power_mw",
  "bess_soc_percent",
  "scheduled_gpu_count",
  "active_gpu_count",
  "shiftable_load_mw",
  "onsite_generation_mw",
  "renewable_energy_mwh",
  "waste_heat_mwh",
  "waste_heat_temperature_c",
]);

const ingestSchema = z.object({
  facilityId: z.string().uuid(),
  sourceId: z.string().uuid(),
  batchId: z.string().uuid(),
  connectorVersion: z.string().trim().min(1).max(80),
  measurements: z
    .array(
      z.object({
        metricKey: operationsMetricSchema,
        assetId: z.string().trim().min(1).max(240).default("facility"),
        eventAt: z.string().datetime(),
        intervalSeconds: z.number().int().positive().max(86_400).nullable().default(null),
        value: z.number().finite(),
        unit: z.string().trim().min(1).max(32),
        sourceRecordId: z.string().trim().min(1).max(300),
      }),
    )
    .min(1)
    .max(10_000),
});

const response = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });

export async function handleOperationsIngest(request: Request, env: OperationsIngestEnv) {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  if (Number(request.headers.get("content-length") ?? 0) > 2_000_000)
    return response({ error: "Ingestion batch is too large." }, 413);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return response({ error: "Operations ingestion is not configured." }, 503);
  const supplied = request.headers.get("x-operations-token") ?? "";
  if (supplied.length < 32 || supplied.length > 512)
    return response({ error: "Invalid connector credential." }, 401);

  let payload: unknown;
  try {
    payload = await readOperationsJson(request, 2_000_000);
  } catch (error) {
    return response(
      {
        error: error instanceof OperationsPayloadError ? error.message : "Invalid ingestion batch.",
      },
      error instanceof OperationsPayloadError ? error.status : 400,
    );
  }
  const parsed = ingestSchema.safeParse(payload);
  if (!parsed.success)
    return response(
      {
        error: "Invalid ingestion batch.",
        fields: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      },
      400,
    );
  const body = parsed.data;
  const invalid = body.measurements.find((item) => {
    if (item.metricKey.endsWith("percent"))
      return item.unit !== "%" || item.value < 0 || item.value > 100;
    if (item.metricKey.endsWith("_mw"))
      return item.unit !== "MW" || (item.metricKey !== "bess_power_mw" && item.value < 0);
    if (item.metricKey.endsWith("_mwh")) return item.unit !== "MWh" || item.value < 0;
    if (item.metricKey.endsWith("_count"))
      return item.unit !== "count" || !Number.isInteger(item.value) || item.value < 0;
    return (
      item.metricKey.endsWith("_temperature_c") &&
      (item.unit !== "C" || item.value < -50 || item.value > 200)
    );
  });
  if (invalid)
    return response({ error: `Invalid unit or physical range for ${invalid.metricKey}.` }, 400);
  const rows = body.measurements.map((item) => ({
    metric_key: item.metricKey,
    asset_id: item.assetId,
    event_at: item.eventAt,
    interval_seconds: item.intervalSeconds,
    value: item.value,
    unit: item.unit,
    source_record_id: item.sourceRecordId,
  }));
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };
  try {
    const write = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/operations_ingest_connector_batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_facility_id: body.facilityId,
        p_source_id: body.sourceId,
        p_batch_id: body.batchId,
        p_records: rows,
        p_token_hash: await sha256(supplied),
        p_connector_version: body.connectorVersion,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!write.ok) {
      const failure = z
        .object({ code: z.string().optional() })
        .passthrough()
        .safeParse(await write.json().catch(() => null));
      if (failure.success && failure.data.code === "42501")
        return response({ error: "Invalid connector scope or credential." }, 403);
      if (failure.success && failure.data.code === "22023")
        return response({ error: "Conflicting or invalid telemetry batch." }, 409);
      return response({ error: "The telemetry store rejected the batch." }, 502);
    }
    const result = z
      .object({
        inserted: z.number().int().nonnegative(),
        duplicates: z.number().int().nonnegative(),
        latestEventAt: z.string().datetime().nullable(),
      })
      .parse(await write.json());
    return response(
      {
        accepted: result.inserted,
        duplicates: result.duplicates,
        batchId: body.batchId,
        latestEventAt: result.latestEventAt,
        controlMode: "read_only",
      },
      202,
    );
  } catch {
    console.error(JSON.stringify({ event: "operations_ingest_failed", batchId: body.batchId }));
    return response({ error: "Operations ingestion is temporarily unavailable." }, 502);
  }
}
