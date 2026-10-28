import { it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  uncertaintyAnalysisResultSchema,
  chronologicalShadowResultSchema,
} from "./investigation-contracts";
const root = ".codex-tmp/domain-http";
it.skipIf(!existsSync(`${root}/chronological.json`))(
  "accepts genuine HTTP Engine results for every exposed method",
  () => {
    for (const method of [
      "independent_scenario_benchmark",
      "common_command_scenario_milp",
      "chronological",
    ]) {
      const job = JSON.parse(readFileSync(`${root}/${method}.json`, "utf8"));
      const result =
        method === "chronological"
          ? chronologicalShadowResultSchema.parse(job.result_payload)
          : uncertaintyAnalysisResultSchema.parse(job.result_payload);
      expect(result.automatic_live_dispatch_authorized).toBe(false);
      expect(result.result_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
  },
);
