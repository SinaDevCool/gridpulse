import type { CandidateSite, Evidence, IntervalProfile, Scenario } from "@/lib/assessment-model";

export type Props = {
  site: CandidateSite;
  evidence: Evidence[];
  scenarios: Scenario[];
  profiles: IntervalProfile[];
  refresh: () => Promise<void>;
};
