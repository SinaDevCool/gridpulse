import type { PilotMetricRecord } from "./record-contracts";
import type { OperatorPackage, ProjectSiteCandidate, Scenario } from "@/lib/assessment-model";
import type { DispatchAnalysis } from "@/lib/fca-engine";
import { type FormEvent } from "react";
import { type FlexibleLoadSpecification } from "../flexible-load";
import { type Props } from "./contracts";

/** Static public contract; implementation conforms to this boundary. */
export interface StrategyControllerContract {
  view: "options" | "screen" | "flexibility" | "deliver";
  setView: import("react").Dispatch<
    import("react").SetStateAction<"options" | "screen" | "flexibility" | "deliver">
  >;
  busy: boolean;
  candidateBusy: boolean;
  intervalResult: DispatchAnalysis | null;
  input: FlexibleLoadSpecification;
  strategyRecords:
    | NoInfer<{
        candidates: ProjectSiteCandidate[];
        packages: OperatorPackage[];
        metrics: PilotMetricRecord[];
        engagement: {
          estimated_connection_cost_eur: number | null;
          indicated_connection_date: string | null;
        } | null;
      }>
    | undefined;
  candidates: ProjectSiteCandidate[];
  packages: OperatorPackage[];
  metrics: PilotMetricRecord[];
  activeScenarios: Scenario[];
  preferredScenario: Scenario | undefined;
  maturity: {
    score: number;
    checks: {
      key: string;
      ready: boolean;
      weight: number;
    }[];
    blockers: string[];
  };
  operator: import("@/lib/german-grid-screening").OperatorScreening;
  result: import("../domain").FlexibilityResult;
  specificationValidation: import("../flexible-load").FlexibleLoadValidation;
  liveOptions: import("../connection-options").ConnectionOptionResult[];
  packageGate: {
    ready: boolean;
    blockers: string[];
  };
  decisionMatrix: import("../decision-matrix").DecisionMatrixRow[];
  preferredOption: import("../decision-matrix").DecisionMatrixRow | null;
  snapshot: import("../deliverables").OperatorPackageSnapshot;
  analyse: (event: FormEvent<HTMLFormElement>) => void;
  saveFlexibility: () => Promise<unknown>;
  addCandidate: (event: FormEvent<HTMLFormElement>) => Promise<unknown>;
  persistPackage: (status: "draft" | "internal_review" | "approved" | "issued") => Promise<unknown>;
  saveDecision: () => Promise<unknown>;
  savePilotSnapshot: () => Promise<unknown>;
  suggestedScenarios: (string | number)[][];
  createStandardScenarios: () => Promise<unknown>;
  preferScenario: (scenarioId: string) => Promise<unknown>;
  duplicateScenario: (scenario: Scenario) => Promise<unknown>;
  archiveScenario: (scenario: Scenario) => Promise<unknown>;
  runIntervalSimulation: () => Promise<unknown>;
  site: import("@/lib/assessment-model").CandidateSite;
  evidence: import("@/lib/assessment-model").Evidence[];
  profiles: import("@/lib/assessment-model").IntervalProfile[];
  refresh: () => Promise<void>;
  setBusy: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setCandidateBusy: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  refetchStrategyRecords: (options?: import("@tanstack/query-core").RefetchOptions) => Promise<
    import("@tanstack/query-core").QueryObserverResult<
      NoInfer<{
        candidates: ProjectSiteCandidate[];
        packages: OperatorPackage[];
        metrics: PilotMetricRecord[];
        engagement: {
          estimated_connection_cost_eur: number | null;
          indicated_connection_date: string | null;
        } | null;
      }>,
      Error
    >
  >;
  scenarios: Scenario[];
  setIntervalResult: import("react").Dispatch<
    import("react").SetStateAction<DispatchAnalysis | null>
  >;
}
