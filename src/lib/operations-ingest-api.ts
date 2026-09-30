import { z } from "zod";

export type OperationsIngestEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OPERATIONS_INGEST_TOKEN?: string;
};

const metricSchema = z.enum([
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
]);

const ingestSchema = z.object({
  facilityId: z.string().uuid(),
  sourceId: z.string().uuid(),
  batchId: z.string().uuid(),
  connectorVersion: z.string().trim().min(1).max(80),
  measurements: z
    .array(
      z.object({
        metricKey: metricSchema,
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
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.OPERATIONS_INGEST_TOKEN)
    return response({ error: "Operations ingestion is not configured." }, 503);
  const supplied = request.headers.get("x-operations-token") ?? "";
  if (!(await equalSecrets(supplied, env.OPERATIONS_INGEST_TOKEN)))
    return response({ error: "Invalid connector credential." }, 401);

  const parsed = ingestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return response(
      {
        error: "Invalid ingestion batch.",
        fields: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      },
      400,
    );
  const body = parsed.data;
  const rows = body.measurements.map((item) => ({
    facility_id: body.facilityId,
    source_id: body.sourceId,
    metric_key: item.metricKey,
    asset_id: item.assetId,
    event_at: item.eventAt,
    interval_seconds: item.intervalSeconds,
    value: item.value,
    unit: item.unit,
    value_kind: "observed",
    quality: "accepted",
    source_record_id: item.sourceRecordId,
    ingestion_batch_id: body.batchId,
  }));
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
    prefer: "resolution=ignore-duplicates,return=minimal",
  };
  const write = await fetch(
    `${env.SUPABASE_URL}/rest/v1/operations_measurements?on_conflict=source_id,source_record_id,metric_key,asset_id`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!write.ok) return response({ error: "The telemetry store rejected the batch." }, 502);
  const latestEventAt = rows.reduce(
    (latest, row) => (row.event_at > latest ? row.event_at : latest),
    rows[0].event_at,
  );
  await Promise.all([
    fetch(
      `${env.SUPABASE_URL}/rest/v1/operations_sources?id=eq.${encodeURIComponent(body.sourceId)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          health: "healthy",
          last_received_at: new Date().toISOString(),
          connector_version: body.connectorVersion,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    ),
    fetch(`${env.SUPABASE_URL}/rest/v1/operations_source_watermarks?on_conflict=source_id`, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        source_id: body.sourceId,
        facility_id: body.facilityId,
        latest_event_at: latestEventAt,
        latest_received_at: new Date().toISOString(),
        consecutive_failures: 0,
        last_error_code: null,
      }),
      signal: AbortSignal.timeout(8_000),
    }),
  ]);
  return response(
    { accepted: rows.length, batchId: body.batchId, latestEventAt, controlMode: "read_only" },
    202,
  );
}

async function equalSecrets(left: string, right: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [left, right].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  const leftBytes = new Uint8Array(a);
  const rightBytes = new Uint8Array(b);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1)
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
}
