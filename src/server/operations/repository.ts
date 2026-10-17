import { z } from "zod";

export type OperationsPersistenceConfig = { url: string; publicKey: string; serviceKey?: string };
export type OperationsPersistenceEnvironment = {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function operationsPersistenceConfig(
  env: OperationsPersistenceEnvironment,
): OperationsPersistenceConfig | null {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && publicKey ? { url, publicKey, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY } : null;
}

const evidenceTables = [
  "operations_facilities",
  "operations_sources",
  "operations_source_watermarks",
  "operations_measurements",
  "operations_battery_assets",
  "operations_workloads",
  "operations_forecasts",
  "operations_recommendations",
  "operations_verifications",
  "operations_data_quality",
  "operations_operating_agreements",
  "operations_calculation_runs",
  "operations_dispatch_approvals",
] as const;
export type OperationsEvidenceTable = (typeof evidenceTables)[number];
export interface OperationsEvidenceReader {
  readRows(
    table: OperationsEvidenceTable,
    parameters: string,
  ): Promise<Array<Record<string, unknown>>>;
}

/** User reads retain the supplied bearer token and never use service-role credentials. */
export class SupabaseOperationsRepository implements OperationsEvidenceReader {
  constructor(
    private readonly config: OperationsPersistenceConfig,
    private readonly authorization: string,
    private readonly transport: typeof fetch = fetch,
  ) {}

  verifyUser() {
    return this.transport(`${this.config.url}/auth/v1/user`, {
      headers: { apikey: this.config.publicKey, authorization: this.authorization },
      signal: AbortSignal.timeout(10_000),
    });
  }
  async readWorkspaceSnapshot(facilityId: string, start: string, end: string) {
    const result = await this.transport(
      `${this.config.url}/rest/v1/rpc/operations_workspace_snapshot`,
      {
        method: "POST",
        headers: {
          apikey: this.config.publicKey,
          authorization: this.authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_facility_id: facilityId, p_start: start, p_end: end }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!result.ok) throw new Error(`operations_workspace_snapshot:${result.status}`);
    const body: unknown = await result.json();
    if (body === null) return null;
    const schema = z.object(
      Object.fromEntries(
        evidenceTables.map((table) => [table, z.array(z.record(z.unknown())).max(15_000)]),
      ),
    );
    return schema.parse(body);
  }
  async readRows(table: OperationsEvidenceTable, parameters: string) {
    if (!evidenceTables.includes(table)) throw new Error("Invalid Operations table");
    const query = new URLSearchParams(parameters);
    const limit = Number(query.get("limit") ?? 10_000);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_000)
      throw new Error("Invalid Operations row limit");
    query.set("limit", String(limit));
    const result = await this.transport(`${this.config.url}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: this.config.publicKey,
        authorization: this.authorization,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) throw new Error(`${table}:${result.status}`);
    return z.array(z.record(z.unknown())).parse(await result.json());
  }
}

export interface OperationsCalculationWriter {
  recordCalculation(payload: Record<string, unknown>): Promise<Response>;
}

/** Construct only after verifying user identity and facility access through the reader. */
export class SupabaseOperationsCalculationWriter implements OperationsCalculationWriter {
  constructor(
    private readonly config: Pick<OperationsPersistenceConfig, "url" | "serviceKey">,
    private readonly transport: typeof fetch = fetch,
  ) {}

  recordCalculation(payload: Record<string, unknown>) {
    if (!this.config.serviceKey)
      throw new Error("Trusted assessment persistence is not configured");
    return this.transport(`${this.config.url}/rest/v1/rpc/operations_record_calculation`, {
      method: "POST",
      headers: {
        apikey: this.config.serviceKey,
        authorization: `Bearer ${this.config.serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
  }
}
