import { finderReleaseToken, FinderReleaseChangedError } from "../../config/finder-release";

export type C1StudyPayload = {
  node_study: {
    available: boolean;
    reason?: string;
    validation_class?: string;
    solver?: string;
    solver_version?: string;
    completed_at?: string;
    result?: {
      firm_import_capacity_mw?: number;
      base_case_capacity_mw?: number;
      binding_case?: string;
      binding_constraint?: string;
    };
    model?: {
      key: string;
      version: string;
      source_name: string;
      source_url: string;
      licence: string;
    };
  };
  benchmark_validation: C1StudyPayload["node_study"];
  evidence_boundary: string;
  c2?: C2EnvelopePayload;
  c3?: C3AssessmentPayload;
};

export type C3AssessmentPayload = {
  available: boolean;
  validationClass?: string;
  representation?: string;
  message?: string;
  flexibilitySummary?: {
    constrained_hours?: number;
    load_reduced_mwh?: number;
    onsite_curtailed_mwh?: number;
    unserved_energy_mwh?: number;
    battery_throughput_mwh?: number;
    grid_import_mwh?: number;
    grid_export_mwh?: number;
  };
  security?: {
    representation?: string;
    contingency_coverage?: { assessed_count?: number; operator_approved_complete_set?: boolean };
    import_capacity?: { values?: { firm_import_capacity_mw?: number } };
    export_capacity?: { values?: { firm_export_capacity_mw?: number } };
  };
  fca?: {
    dynamic?: { status?: string; limit_mode?: string };
    static?: { status?: string; limit_mode?: string };
  };
  limitations?: string[];
  benchmark?: C3AssessmentPayload;
};

export type C2EnvelopePayload = {
  node_envelope: C2EnvelopeResult;
  benchmark_ensemble: C2EnvelopeResult;
  evidence_boundary: string;
};

export type C2EnvelopeResult = {
  available: boolean;
  reason?: string;
  validation_class?: string;
  target_year?: number;
  weather_years?: number[];
  completed_at?: string;
  summary?: {
    target_year?: number;
    weather_years?: number[];
    p10_capacity_mw?: number;
    p50_capacity_mw?: number;
    p90_capacity_mw?: number;
    minimum_capacity_mw?: number;
    maximum_capacity_mw?: number;
    constrained_hours?: number;
    maximum_curtailment_mw?: number;
    expected_curtailed_mwh?: number;
    hour_count?: number;
    unique_operating_states_solved?: number;
  };
  model?: { key: string; version: string };
  sources?: Array<{ source_key: string; metric: string; source_url: string; licence: string }>;
};

export async function loadC1Study(nodeId: string, signal?: AbortSignal) {
  try {
    const response = await fetch(
      `/api/power-finder/study?node=${encodeURIComponent(nodeId)}&release=${encodeURIComponent(finderReleaseToken)}`,
      {
        signal,
      },
    );
    if (response.status === 409) throw new FinderReleaseChangedError();
    if (!response.ok) throw new Error("Study registry unavailable.");
    return (await response.json()) as C1StudyPayload;
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      node_study: {
        available: false,
        reason:
          error instanceof FinderReleaseChangedError
            ? error.message
            : "Study service unavailable; no reviewed operator result was loaded.",
      },
      benchmark_validation: {
        available: false,
        reason: "Open the synthetic network study to inspect demonstration benchmarks.",
      },
      evidence_boundary:
        "Unavailable study evidence is not zero capacity. No benchmark is substituted for this node.",
    } satisfies C1StudyPayload;
  }
}
