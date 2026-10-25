import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { briefRequestSchema } from "@/features/operations/copilot/brief";
import { readOperationsJson, OperationsPayloadError } from "@/lib/operations-request";
import { BriefError, generatePlanBrief, ownedBriefEvidence } from "@/server/operations/copilot";

export const Route = createFileRoute("/api/operations/brief")({ server: { handlers: {
  POST: async ({ request }) => {
    const config = env as unknown as { OPENAI_API_KEY?: string; COPILOT_ENABLED?: string;
      COPILOT_MODEL?: string; COPILOT_ANALYTICS_URL?: string;
      COPILOT_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> } };
    const headers = { "cache-control": "no-store" };
    if (config.COPILOT_ENABLED !== "true" || !config.OPENAI_API_KEY || !config.COPILOT_ANALYTICS_URL || !config.COPILOT_RATE_LIMITER)
      return Response.json({ error: "Plan explanations are not configured." }, { status: 503, headers });
    try {
      const bearer = request.headers.get("authorization") ?? "";
      if (!/^Bearer [^\s]+$/i.test(bearer)) throw new BriefError(401, "A calculation session is required.");
      const input = briefRequestSchema.parse(await readOperationsJson(request, 2048));
      const allowed = await config.COPILOT_RATE_LIMITER.limit({ key: `brief:${request.headers.get("cf-connecting-ip") ?? "local"}` });
      if (!allowed.success) return Response.json({ error: "Please wait before requesting another explanation." },
        { status: 429, headers: { ...headers, "retry-after": "60" } });
      const evidence = await ownedBriefEvidence(config.COPILOT_ANALYTICS_URL, bearer, input.jobId, input.resultFingerprint);
      return Response.json(await generatePlanBrief(evidence, config.OPENAI_API_KEY, config.COPILOT_MODEL ?? "gpt-4o-mini"), { headers });
    } catch (error) {
      if (error instanceof BriefError || error instanceof OperationsPayloadError)
        return Response.json({ error: error.message }, { status: error.status, headers });
      return Response.json({ error: "The explanation could not be verified. No brief accepted." }, { status: 422, headers });
    }
  },
} } });
