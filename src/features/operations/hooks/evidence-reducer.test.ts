import { describe, expect, it } from "vitest";
import { evidenceReducer, type EvidenceState } from "./evidence-reducer";
import { buildOperationsScenario } from "../scenario-engine";
import { assessWorkloads, buildScenarioWorkloads } from "../workload-intelligence";
import { buildImportReport } from "../import-report";

function initial(): EvidenceState {
  return {
    importReports: {},
    workloads: [],
    telemetry: [],
    workloadMessage: "",
    workloadError: "old error",
    workloadAssessment: null,
    workloadSignature: "old",
    facility: [],
    battery: [],
    powerMessage: "",
    powerError: "",
  };
}
describe("atomic evidence transitions", () => {
  it("accepts inputs, assessment, identity and report together without mutating the previous state", () => {
    const previous = initial();
    const model = buildOperationsScenario();
    const workloads = buildScenarioWorkloads(model);
    const assessment = assessWorkloads(workloads, [], model);
    const next = evidenceReducer(previous, {
      type: "accept-workloads",
      workloads,
      assessment,
      signature: "new",
      kind: "scheduler",
      message: "accepted",
      report: buildImportReport(
        "scheduler",
        "jobs.csv",
        workloads.map((row) => row.submittedAt),
        true,
      ),
    });
    expect(next.workloads).toBe(workloads);
    expect(next.workloadAssessment).toBe(assessment);
    expect(next.workloadSignature).toBe("new");
    expect(next.workloadError).toBe("");
    expect(next.importReports.scheduler?.filename).toBe("jobs.csv");
    expect(previous.workloadSignature).toBe("old");
  });
  it("restores scenario evidence and clears the previous server assessment", () => {
    const state = initial();
    const next = evidenceReducer(state, {
      type: "restore-workloads",
      workloads: [],
      signature: "restored",
    });
    expect(next.workloadAssessment).toBeNull();
    expect(next.telemetry).toEqual([]);
    expect(next.workloadError).toBe("");
    expect(next.workloadSignature).toBe("restored");
  });
  it("applies functional updates to the latest reducer state", () => {
    const state = initial();
    const next = evidenceReducer(state, {
      type: "field",
      field: "workloadMessage",
      value: (current) => current + "one",
    });
    expect(
      evidenceReducer(next, {
        type: "field",
        field: "workloadMessage",
        value: (current) => current + "two",
      }).workloadMessage,
    ).toBe("onetwo");
  });
});
