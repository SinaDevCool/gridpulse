from __future__ import annotations

import tempfile
from pathlib import Path

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.network_study import NetworkModelInput, PandapowerProvider
from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition
from grid_data.p0_p4_publish import publish_pipeline_result
from grid_data.p1_permutation import execute_permutations
from grid_data.p2_ensemble import summarize_uncertainty
from grid_data.p3_surrogate import train_surrogates
from grid_data.release2_pipeline import run_release2


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    payload = dict(job.input_payload)
    scenarios = [ScenarioDefinition(**item) for item in payload.pop("scenarios")]
    candidate_scenarios = [
        ScenarioDefinition(**item) for item in payload.pop("candidate_scenarios", [])
    ]
    requested = float(payload.pop("requested_import_mw"))
    train = bool(payload.pop("train_surrogate", False))
    batch_size = int(payload.pop("active_learning_batch_size", 32))
    solver_budget = int(payload.pop("solver_budget", 128))
    model = NetworkModelInput(**payload)
    provider = PandapowerProvider()
    result = execute_permutations(model, scenarios, provider)
    outcomes = [PhysicsOutcome(**item) for item in result["outcomes"]]
    for outcome in outcomes:
        outcome.features["requested_import_mw"] = requested
    result["ensemble"] = summarize_uncertainty(outcomes, requested_import_mw=requested)
    if train:
        bundle = train_surrogates(outcomes)
        result["surrogate_registry"] = bundle.registry
        if candidate_scenarios:
            artifact_directory = Path(tempfile.mkdtemp(prefix="gridpulse-release2-"))
            release2_artifact_path = artifact_directory / f"{job.id}.joblib"

            def solve_batch(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
                solved = execute_permutations(model, items, provider)
                rows = [PhysicsOutcome(**item) for item in solved["outcomes"]]
                for row in rows:
                    row.features["requested_import_mw"] = requested
                return rows

            def solve_one(item: ScenarioDefinition) -> PhysicsOutcome:
                rows = solve_batch([item])
                if not rows:
                    raise RuntimeError("Release 2 physics verification produced no outcome.")
                return rows[0]

            mandatory = {
                str(item["id"]) for item in model.contingencies if item.get("mandatory", True)
            }
            result["release2"] = run_release2(
                initial_outcomes=outcomes,
                candidate_scenarios=candidate_scenarios,
                requested_import_mw=requested,
                batch_size=batch_size,
                mandatory_contingencies=mandatory,
                solve_batch=solve_batch,
                solve_one=solve_one,
                artifact_path=release2_artifact_path,
                solver_budget=solver_budget,
            )
    result["public_visibility"] = "private_internal_only"
    result["ledger_publication"] = publish_pipeline_result(
        job=job,
        result=result,
        scenarios=scenarios,
        surrogate_registry=result.get("surrogate_registry"),
        release2=result.get("release2"),
        artifact_path=release2_artifact_path,
        supabase_url=context.supabase_url,
        service_role_key=context.service_role_key,
    )
    return result
