import { describe, expect, it, vi } from "vitest";
import { providerSettings, providerTransport, requestCopilotSelection } from "./copilot";

describe("interchangeable copilot transport", () => {
  it("keeps an explicit fallback selected for later stages of the same request", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ ok: true }));
    const transport = providerTransport({ provider: "meta", key: "m", model: "muse-spark-1.3",
      fallback: { provider: "openai", key: "o", model: "gpt-4o-mini" } }, fetcher);
    await transport("https://api.openai.com/v1/responses", { body: "{}" });
    await transport("https://api.openai.com/v1/responses", { body: "{}" });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      "https://api.meta.ai/v1/responses", "https://api.openai.com/v1/responses", "https://api.openai.com/v1/responses",
    ]);
  });
  it("requires the selected provider key and an explicit Meta model", () => {
    expect(() => providerSettings({ COPILOT_PROVIDER: "meta", OPENAI_API_KEY: "other" })).toThrow();
    expect(() => providerSettings({ COPILOT_PROVIDER: "unknown" })).toThrow();
    expect(() => providerSettings({ COPILOT_PROVIDER: "meta", META_API_KEY: "m", COPILOT_MODEL: "muse-spark-1.3-contributor" })).toThrow("Standard");
  });
  it("routes Meta with its own credential and reasoning budget", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "completed", model: "muse-spark-1.3",
      output: [{ content: [{ type: "output_text", text: '{"intent":"checks"}' }] }] }));
    const settings = providerSettings({ COPILOT_PROVIDER: "meta", COPILOT_MODEL: "muse-spark-1.3", META_API_KEY: "meta-test" });
    const answer = await requestCopilotSelection({}, "Select only", {}, settings.key, settings.model, providerTransport(settings, fetcher));
    expect(answer.selection).toEqual({ intent: "checks" });
    expect(fetcher.mock.calls[0][0]).toBe("https://api.meta.ai/v1/responses");
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer meta-test");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ store: false, max_output_tokens: 4096, reasoning: { effort: "low" } });
  });
  it("falls back once for provider availability but not a successful refusal", async () => {
    const settings = { provider: "meta" as const, key: "m", model: "muse-spark-1.3",
      fallback: { provider: "openai" as const, key: "o", model: "gpt-4o-mini" } };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 402 })).mockResolvedValueOnce(Response.json({ ok: true }));
    const attempts: string[] = [];
    await providerTransport(settings, fetcher, attempts)("https://api.openai.com/v1/responses", { body: "{}" });
    expect(attempts).toEqual(["meta", "openai"]);
    expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer o");
    const refused = vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [{ content: [{ type: "refusal" }] }] }));
    await expect(requestCopilotSelection({}, "", {}, "m", settings.model, providerTransport(settings, refused))).rejects.toThrow("declined");
    expect(refused).toHaveBeenCalledTimes(1);
  });
  it("does not fail over after invalid structured output or authentication failure", async () => {
    const settings = { provider: "meta" as const, key: "m", model: "muse-spark-1.3",
      fallback: { provider: "openai" as const, key: "o", model: "gpt-4o-mini" } };
    for (const response of [new Response(null, { status: 401 }), Response.json({ status: "completed",
      output: [{ content: [{ type: "output_text", text: "not json" }] }] })]) {
      const fetcher = vi.fn().mockResolvedValue(response);
      await expect(requestCopilotSelection({}, "", {}, "m", settings.model, providerTransport(settings, fetcher))).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("never substitutes the provider credential on an analytics call", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    await providerTransport({ provider: "meta", key: "m", model: "muse-spark-1.3" }, fetcher)("https://analytics.invalid/v1/jobs/id", { headers: { authorization: "Bearer visitor" } });
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer visitor");
  });
});

it("reserves paid calls before dispatch and retains unknown usage reservations",async()=>{
 const reserve=vi.fn().mockResolvedValue(false),settle=vi.fn();const fetcher=vi.fn();
 const settings={provider:"meta" as const,key:"test",model:"muse-spark-1.3"};
 await expect(providerTransport(settings,fetcher,[],[],{reserve,settle})("https://api.openai.com/v1/responses",{body:"{}"})).rejects.toThrow("budget exhausted");
 expect(fetcher).not.toHaveBeenCalled();
 reserve.mockResolvedValue(true);fetcher.mockResolvedValue(Response.json({status:"completed",model:"muse-spark-1.3",output:[]}));
 await providerTransport(settings,fetcher,[],[],{reserve,settle})("https://api.openai.com/v1/responses",{body:"{}"});expect(settle).not.toHaveBeenCalled();
 fetcher.mockResolvedValue(Response.json({status:"completed",model:"muse-spark-1.3",usage:{input_tokens:100,output_tokens:10},output:[]}));
 await providerTransport(settings,fetcher,[],[],{reserve,settle})("https://api.openai.com/v1/responses",{body:"{}"});expect(settle).toHaveBeenCalledWith(expect.any(String),168);
});
