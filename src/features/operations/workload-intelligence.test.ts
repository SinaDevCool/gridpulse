import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "./scenario-engine";
import {
  assessWorkloads,
  buildScenarioWorkloads,
  parseGpuTelemetryCsv,
  parseWorkloadCsv,
} from "./workload-intelligence";

const model = buildOperationsScenario();

describe("workload intelligence", () => {
  it("keeps scenario workloads explicitly reference-based", () => {
    const assessment = assessWorkloads(buildScenarioWorkloads(model), [], model);
    expect(assessment.source).toBe("scenario");
    expect(assessment.decisions.every((workload) => workload.powerEvidence === "reference")).toBe(
      true,
    );
    expect(assessment.recommendedJobs).toBeGreaterThan(0);
    expect(assessment.recommendedPowerMw).toBeCloseTo(assessment.requiredWorkloadResponseMw);
    expect(assessment.recommendedJobs).toBeLessThan(assessment.eligibleJobs);
  });

  it("protects critical workloads and only recommends eligible jobs", () => {
    const assessment = assessWorkloads(buildScenarioWorkloads(model), [], model);
    const critical = assessment.decisions.find((workload) => workload.workloadClass === "critical");
    expect(critical).toMatchObject({
      eligible: false,
      recommended: false,
      reason: "Protected critical workload",
    });
    expect(
      assessment.decisions
        .filter((workload) => workload.recommended)
        .every((workload) => workload.eligible),
    ).toBe(true);
  });

  it("parses scheduler evidence and uses measured GPU telemetry", () => {
    const workloads = parseWorkloadCsv(
      [
        "workload_id,name,workload_class,status,priority,earliest_start,deadline,expected_duration_minutes,requested_gpu_count,minimum_gpu_count,checkpointable,preemptible,maximum_delay_minutes",
        "job-1,Nightly training,training,running,20,2026-09-02T01:00:00Z,2026-09-02T08:00:00Z,120,8,4,true,true,120",
      ].join("\n"),
    );
    const telemetry = parseGpuTelemetryCsv(
      [
        "timestamp,workload_id,gpu_uuid,power_watts,gpu_utilization_percent",
        "2026-09-02T02:00:00Z,job-1,GPU-a,500000,75",
        "2026-09-02T02:05:00Z,job-1,GPU-b,700000,80",
      ].join("\n"),
    );
    const assessment = assessWorkloads(workloads, telemetry, model);
    expect(assessment.decisions[0].powerEvidence).toBe("measured");
    expect(assessment.decisions[0].estimatedPowerMw).toBe(0.6);
    expect(assessment.telemetryCompletenessPercent).toBeGreaterThan(0);
  });

  it("rejects incomplete exports instead of silently inventing fields", () => {
    expect(() => parseWorkloadCsv("workload_id,name\njob-1,Test")).toThrow(
      /Missing workload columns/,
    );
    expect(() => parseGpuTelemetryCsv("timestamp,workload_id\n2026-09-02T00:00:00Z,job-1")).toThrow(
      /Missing telemetry columns/,
    );
  });
});
