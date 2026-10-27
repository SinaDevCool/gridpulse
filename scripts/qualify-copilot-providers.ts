/** Opt-in, tiny real-provider contract checks. No customer inputs, deployment, or credential output. */
import { providerSettings, providerTransport, requestCopilotSelection } from "../src/server/operations/copilot";
for (const provider of ["meta", "openai"] as const) {
  const key = provider === "meta" ? process.env.META_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) { console.log(JSON.stringify({ provider, status: "skipped", reason: "key absent" })); continue; }
  const settings = providerSettings({ COPILOT_PROVIDER: provider, META_API_KEY: process.env.META_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY, COPILOT_MODEL: provider === "meta" ? "muse-spark-1.3" : "gpt-4o-mini" });
  try {
    const answer = await requestCopilotSelection({ task: "qualification", allowed: ["checks"] },
      "Return intent checks using the supplied schema. This is a synthetic API contract test.",
      { type: "object", additionalProperties: false, required: ["intent"], properties: { intent: { type: "string", enum: ["checks"] } } },
      settings.key, settings.model, providerTransport(settings));
    if (JSON.stringify(answer.selection) !== JSON.stringify({ intent: "checks" })) throw new Error("Selection mismatch");
    console.log(JSON.stringify({ provider, status: "passed", model: answer.model, usage: answer.usage }));
  } catch { console.log(JSON.stringify({ provider, status: "failed", reason: "Provider contract check failed; no upstream content logged" })); process.exitCode = 1; }
}
