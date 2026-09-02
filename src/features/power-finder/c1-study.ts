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
    model?: { key: string; version: string; source_name: string; source_url: string; licence: string };
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
  fca?: { dynamic?: { status?: string; limit_mode?: string }; static?: { status?: string; limit_mode?: string } };
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

type BenchmarkArtifact = {
  validation_class: string;
  generated_at: string;
  model_id: string;
  model_version: string;
  provenance: { source: string; source_url: string; license: string };
  results: Array<{
    study_type: string;
    provider: string;
    solver_version: string;
    values: C1StudyPayload["node_study"]["result"];
  }>;
};

type C2BenchmarkArtifact = {
  validation_class: string;
  generated_at: string;
  model: { id: string; version: string };
  sources: Array<{
    source_key: string;
    metric: string;
    provenance: { source_url: string; licence?: string; license?: string };
  }>;
  envelope: C2EnvelopeResult["summary"];
  evidence_boundary: string;
};

async function localBenchmark(signal?: AbortSignal): Promise<C1StudyPayload> {
  const [response, c2Response, c3Response] = await Promise.all([
    fetch("/power-finder/c1-benchmark-validation.json", { signal }),
    fetch("/power-finder/c2-hourly-benchmark.json", { signal }),
    fetch("/power-finder/c3-security-flexibility-benchmark.json", { signal }),
  ]);
  if (!response.ok) throw new Error("C1 validation artifact is unavailable.");
  const artifact = (await response.json()) as BenchmarkArtifact;
  const c2Artifact = c2Response.ok ? ((await c2Response.json()) as C2BenchmarkArtifact) : null;
  const c3Artifact = c3Response.ok ? (await c3Response.json()) as {
    validation_class: string;
    security: C3AssessmentPayload["security"];
    flexibility: { summary: C3AssessmentPayload["flexibilitySummary"] };
    fca: C3AssessmentPayload["fca"];
    evidence_boundary: string;
  } : null;
  const capacity = artifact.results.find((result) => result.study_type === "capacity");
  return {
    node_study: {
      available: false,
      reason: "No reviewed operator electrical model is linked to this mapped node.",
    },
    benchmark_validation: {
      available: Boolean(capacity),
      validation_class: artifact.validation_class,
      solver: capacity?.provider,
      solver_version: capacity?.solver_version,
      completed_at: artifact.generated_at,
      result: capacity?.values,
      model: {
        key: artifact.model_id,
        version: artifact.model_version,
        source_name: artifact.provenance.source,
        source_url: artifact.provenance.source_url,
        licence: artifact.provenance.license,
      },
    },
    evidence_boundary:
      "Benchmark solver validation is not location capacity. A reviewed operator model must be linked before a node study can be shown.",
    c2: {
      node_envelope: {
        available: false,
        reason: "No reviewed operator hourly model is linked to this mapped node.",
      },
      benchmark_ensemble: c2Artifact
        ? {
            available: true,
            validation_class: c2Artifact.validation_class,
            completed_at: c2Artifact.generated_at,
            target_year: c2Artifact.envelope?.target_year,
            weather_years: c2Artifact.envelope?.weather_years,
            summary: c2Artifact.envelope,
            model: { key: c2Artifact.model.id, version: c2Artifact.model.version },
            sources: c2Artifact.sources.map((source) => ({
              source_key: source.source_key,
              metric: source.metric,
              source_url: source.provenance.source_url,
              licence: source.provenance.licence ?? source.provenance.license ?? "see source",
            })),
          }
        : { available: false, reason: "No C2 benchmark ensemble is available." },
      evidence_boundary:
        c2Artifact?.evidence_boundary ??
        "Public hourly context does not establish node capacity without an operator model.",
    },
    c3: {
      available: false,
      representation: "no_operator_reviewed_security_or_flexibility_assessment",
      message: "No operator-reviewed C3 assessment exists for this mapped node.",
      benchmark: c3Artifact ? {
        available: true,
        validationClass: c3Artifact.validation_class,
        representation: "benchmark_only_not_mapped_node_capacity",
        security: c3Artifact.security,
        flexibilitySummary: c3Artifact.flexibility.summary,
        fca: c3Artifact.fca,
        limitations: [c3Artifact.evidence_boundary],
      } : undefined,
    },
  };
}

export async function loadC1Study(nodeId: string, signal?: AbortSignal) {
  try {
    const response = await fetch(`/api/power-finder/study?node=${encodeURIComponent(nodeId)}`, {
      signal,
    });
    if (!response.ok) throw new Error("Study registry unavailable.");
    return (await response.json()) as C1StudyPayload;
  } catch (error) {
    if (signal?.aborted) throw error;
    return localBenchmark(signal);
  }
}
