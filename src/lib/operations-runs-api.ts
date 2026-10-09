import { z } from "zod";
import {
  operationsAssessmentRequestSchema,
  runOperationsAssessment,
} from "../features/operations/operations-service";
import {
  OperationsPayloadError,
  operationsFingerprint,
  readOperationsJson,
} from "./operations-request";

type RunsEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};
const schema = z.object({
  facilityId: z.string().uuid(),
  assessment: operationsAssessmentRequestSchema,
});
const reply = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-gridpulse-control-mode": "read-only" },
  });

/** Numeric results are recalculated server-side; caller-supplied results are never saved. */
export async function handleOperationsRun(request: Request, env: RunsEnv) {
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return reply({ error: "Authentication required." }, 401);
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publicKey || !env.SUPABASE_SERVICE_ROLE_KEY)
    return reply({ error: "Assessment persistence is not configured." }, 503);
  let inputValidated = false;
  try {
    const input = schema.parse(await readOperationsJson(request, 8_000_000));
    inputValidated = true;
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, authorization },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok)
      return reply({ error: "Authentication required." }, userResponse.status >= 500 ? 502 : 401);
    const user = z.object({ id: z.string().uuid() }).parse(await userResponse.json());
    const facility = await fetch(
      `${url}/rest/v1/operations_facilities?id=eq.${input.facilityId}&select=id&limit=1`,
      { headers: { apikey: publicKey, authorization }, signal: AbortSignal.timeout(10_000) },
    );
    if (!facility.ok) return reply({ error: "Facility access could not be verified." }, 502);
    const accessible = z.array(z.object({ id: z.string().uuid() })).parse(await facility.json());
    if (!accessible.length) return reply({ error: "Facility not found." }, 404);
    const result = runOperationsAssessment(input.assessment);
    const fingerprint = await operationsFingerprint(input.assessment);
    const mode =
      input.assessment.kind === "overview" || input.assessment.kind === "compute"
        ? "scenario"
        : "historical";
    const written = await fetch(`${url}/rest/v1/rpc/operations_record_calculation`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_owner_id: user.id,
        p_facility_id: input.facilityId,
        p_input_snapshot: input.assessment,
        p_result: result,
        p_fingerprint: fingerprint,
        p_calculation_version: result.calculationVersion,
        p_mode: mode,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!written.ok) return reply({ error: "Assessment could not be recorded." }, 502);
    const runId = z
      .string()
      .uuid()
      .parse(await written.json());
    return reply(
      { runId, inputFingerprint: fingerprint, mode, automaticDispatchAuthorized: false },
      201,
    );
  } catch (error) {
    if (error instanceof OperationsPayloadError)
      return reply({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return reply(
        { error: inputValidated ? "Invalid persistence response." : "Invalid assessment input." },
        inputValidated ? 502 : 400,
      );
    console.error(JSON.stringify({ event: "operations_run_failed" }));
    return reply({ error: "Assessment persistence is temporarily unavailable." }, 502);
  }
}
