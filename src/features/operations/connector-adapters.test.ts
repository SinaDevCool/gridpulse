import { describe, expect, it } from "vitest";
import {
  normalizeOpenEmsSnapshot,
  normalizeSlurmJobs,
  parseDcgmPrometheus, reviewSlurmJobs, reviewOpenEmsSnapshot,
} from "./connector-adapters";

describe("operations connector adapters", () => {
  it("normalizes allowlisted DCGM metrics and ignores unrelated series", () => {
    const result = parseDcgmPrometheus(
      [
        "# HELP DCGM_FI_DEV_POWER_USAGE Power draw",
        'DCGM_FI_DEV_POWER_USAGE{gpu="0",UUID="GPU-abc"} 700',
        'DCGM_FI_DEV_GPU_UTIL{gpu="0",UUID="GPU-abc"} 82',
        "process_cpu_seconds_total 9",
      ].join("\n"),
      "2026-09-26T12:00:00.000Z",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      metricKey: "gpu_power_mw",
      value: 0.0007,
      assetId: "gpu:GPU-abc",
    });
  });

  it("normalizes OpenEMS facility and battery measurements", () => {
    const result = normalizeOpenEmsSnapshot(
      { gridActivePowerW: 100_000_000, essActivePowerW: 4_000_000, essSocPercent: 65 },
      "2026-09-26T12:00:00.000Z",
    );
    expect(result.map((item) => item.value)).toEqual([100, 4, 65]);
  });

  it("normalizes Slurm accounting without claiming unavailable evidence", () => {
    const result = normalizeSlurmJobs([
      {
        job_id: 42,
        name: "training",
        state: "RUNNING",
        submit_time: "2026-09-26T10:00:00Z",
        start_time: "2026-09-26T10:10:00Z",
        time_limit_minutes: 120,
        gpu_count: 8,
      },
    ]);
    expect(result[0]).toMatchObject({
      source: "slurm",
      status: "running",
      workloadClass: "training",
      measuredPowerMw: null,
    });
  });
});

it("keeps missing OpenEMS values distinct from zero and rejects invalid SOC", () => {
  expect(normalizeOpenEmsSnapshot({ gridActivePowerW: null, essActivePowerW: "", essSocPercent: 101 })).toEqual([]);
  expect(reviewOpenEmsSnapshot({gridActivePowerW:0}, "2026-01-01T00:00:00Z")).toMatchObject({qualifiedForPlanning:false, records:[{value:0}]});
});
it("does not grant string-false permissions or invent missing GPU/runtime evidence", () => {
  const review=reviewSlurmJobs([{job_id:"j", submit_time:"2026-01-01T00:00:00Z",time_limit_minutes:60,gpu_count:1, checkpointable:"false",preemptible:"false"}]);
  expect(review.records[0]).toMatchObject({checkpointable:false,preemptible:false});
  expect(review.assumptions.length).toBeGreaterThan(0);
  expect(reviewSlurmJobs([{job_id:"j"}]).issues).toHaveLength(1);
});
it("retains timestamped device identity and rejects duplicate or sentinel metrics", () => {
  const line='DCGM_FI_DEV_POWER_USAGE{UUID="GPU-a",GPU_I_ID="1"} 100 1767225600000';
  expect(parseDcgmPrometheus(line)[0]).toMatchObject({assetId:"gpu:GPU-a:1",eventAt:"2026-01-01T00:00:00.000Z"});
  expect(()=>parseDcgmPrometheus(line+"\n"+line)).toThrow("Duplicate");
  expect(parseDcgmPrometheus('DCGM_FI_DEV_POWER_USAGE{UUID="a"} 9223372036854775794')).toEqual([]);
});


it("keeps whitespace and malformed measurement values distinct from measured zero", () => {
  const job = { job_id: "j", submit_time: "2026-01-01T00:00:00Z", time_limit_minutes: 60, gpu_count: 1 };
  expect(reviewSlurmJobs([{ ...job, measured_power_mw: "  " }]).records[0].measuredPowerMw).toBeNull();
  expect(reviewSlurmJobs([{ ...job, measured_power_mw: [] }]).issues).toHaveLength(1);
  expect(normalizeOpenEmsSnapshot({ gridActivePowerW: [] })).toEqual([]);
  expect(reviewSlurmJobs([{ ...job, measured_power_mw: 0 }]).records[0].measuredPowerMw).toBe(0);
});
