import { describe, expect, it } from "vitest";
import { canonicalMilpJob } from "../../../../tests/fixtures/canonical-milp-job";
import { buildSyntheticMilpRequest } from "../synthetic-milp-request";
import { defaultOperationsScenario } from "../scenario-engine";
import { selectCanonicalPresentation } from "../canonical-presentation";
import { compileExperimentProposal, explicitExperimentSelection } from "./experiment-proposal";
const input = buildSyntheticMilpRequest(defaultOperationsScenario);
const job = canonicalMilpJob(input);
const assessment = selectCanonicalPresentation(job, input);
const change = { field: "battery_energy_mwh", asset_id: null, operation: "multiply", value: .5, unit: "x" };
describe("reviewed exact-baseline proposals", () => {
  it("resolves half energy against the accepted input and binds the result identity", async () => {
    const result = await compileExperimentProposal(assessment, job.id, { mode: "alternative", changes: [change] });
    expect(result.changes[0].after).toBe(Number(input.batteries![0].rated_energy_mwh) / 2);
    expect(result.request.baseline_result_fingerprint).toBe(job.result_payload.result_fingerprint);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.request.cases[0].changes).toHaveLength(1);
  });
  it("rejects invented assets, incorrect units, duplicate changes and invalid bounds", async () => {
    for (const changes of [[{ ...change, asset_id: "unknown" }], [{ ...change, unit: "MW" }], [change, change], [{ ...change, value: 0 }]])
      await expect(compileExperimentProposal(assessment, job.id, { mode: "alternative", changes })).rejects.toThrow();
  });
  it("does not guess ambiguous capacity or contradictory quantities", () => {
    expect(explicitExperimentSelection("What if battery capacity is halved?")).toBeNull();
    expect(explicitExperimentSelection("halve battery energy to 20 MWh")).toBeNull();
    expect(explicitExperimentSelection("halve battery energy")?.changes[0]).toMatchObject({ operation: "multiply", value: .5 });
  });
  it("makes equivalent proposals reproducible without mutating the baseline", async () => {
    const before = JSON.stringify(input);
    const raw = { mode: "frozen_plan", changes: [change] };
    const a = await compileExperimentProposal(assessment, job.id, raw);
    expect((await compileExperimentProposal(assessment, job.id, raw)).digest).toBe(a.digest);
    expect(JSON.stringify(input)).toBe(before);
  });
});
