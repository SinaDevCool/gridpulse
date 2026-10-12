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

export interface OperationsEvidenceReader {
  readRows(table: string, parameters: string): Promise<Array<Record<string, unknown>>>;
}

/** User reads always retain the supplied bearer token; privileged writes use a separate method. */
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
  async readRows(table: string, parameters: string) {
    if (!/^operations_[a-z_]+$/.test(table)) throw new Error("Invalid Operations table");
    const result = await this.transport(`${this.config.url}/rest/v1/${table}?${parameters}`, {
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
