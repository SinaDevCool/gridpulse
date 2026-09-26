import { describe, expect, it } from "vitest";
import {
  normalizeOpenEmsSnapshot,
  normalizeSlurmJobs,
  parseDcgmPrometheus,
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
