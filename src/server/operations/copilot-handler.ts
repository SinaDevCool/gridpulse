import { briefRequestSchema } from "../../features/operations/copilot/brief";
import { readOperationsJson, OperationsPayloadError } from "../../lib/operations-request";
import { BriefError, generatePlanBrief, ownedBriefEvidence, ownedAssessment } from "./copilot";
import { conversationRequestSchema } from "../../features/operations/copilot/conversation-contracts";
import { answerConversation } from "../../features/operations/copilot/conversation-query";
import { interpretQuestion } from "./copilot-conversation";

export type CopilotConfig = { OPENAI_API_KEY?: string; COPILOT_ENABLED?: string;
  COPILOT_MODEL?: string; COPILOT_ANALYTICS_URL?: string;
  COPILOT_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> } };

/** One handler shared by the Worker route and direct boundary tests. No second job API. */
async function handleCopilot(request: Request, config: CopilotConfig, fetcher: typeof fetch, conversation: boolean) {
  const headers = { "cache-control": "no-store" };
  if (config.COPILOT_ENABLED !== "true" || !config.OPENAI_API_KEY || !config.COPILOT_ANALYTICS_URL || !config.COPILOT_RATE_LIMITER)
    return Response.json({ error: "Plan explanations are not configured." }, { status: 503, headers });
  try {
    const bearer = request.headers.get("authorization") ?? "";
    if (!/^Bearer [^\s]+$/i.test(bearer)) throw new BriefError(401, "A calculation session is required.");
    const raw = await readOperationsJson(request, conversation ? 16_384 : 2048);
    const input = (conversation ? conversationRequestSchema : briefRequestSchema).safeParse(raw);
    if (!input.success) throw new BriefError(400, "Invalid explanation request or unsupported brief version.");
    const allowed = await config.COPILOT_RATE_LIMITER.limit({ key: `brief:${request.headers.get("cf-connecting-ip") ?? "local"}` });
    if (!allowed.success) return Response.json({ error: "Please wait before requesting another explanation." },
      { status: 429, headers: { ...headers, "retry-after": "60" } });
    if (conversation) {
      const question = conversationRequestSchema.parse(raw);
      const assessment = await ownedAssessment(config.COPILOT_ANALYTICS_URL, bearer, question.jobId, question.resultFingerprint, fetcher);
      const interpreted = await interpretQuestion(assessment, question, config.OPENAI_API_KEY, config.COPILOT_MODEL ?? "gpt-4o-mini", fetcher);
      return Response.json(answerConversation(assessment, question, interpreted.query, interpreted.provider), { headers });
    }
    const evidence = await ownedBriefEvidence(config.COPILOT_ANALYTICS_URL, bearer, input.data.jobId, input.data.resultFingerprint, fetcher);
    return Response.json(await generatePlanBrief(evidence, config.OPENAI_API_KEY, config.COPILOT_MODEL ?? "gpt-4o-mini", fetcher), { headers });
  } catch (error) {
    if (error instanceof BriefError || error instanceof OperationsPayloadError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
      return Response.json({ error: "Explanation timed out. The calculated plan is still available." }, { status: 504, headers });
    return Response.json({ error: "The explanation could not be verified. No brief accepted." }, { status: 422, headers });
  }
}

export const handlePlanBrief = (request: Request, config: CopilotConfig, fetcher: typeof fetch = fetch) =>
  handleCopilot(request, config, fetcher, false);
export const handlePlanConversation = (request: Request, config: CopilotConfig, fetcher: typeof fetch = fetch) =>
  handleCopilot(request, config, fetcher, true);
