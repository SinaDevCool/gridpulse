from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition
from grid_data.p1_permutation import execute_permutations
from grid_data.release3_pipeline import run_release3


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    payload = job.input_payload
    model = NetworkModelInput(**payload["network_model"])
    training_scenarios = [ScenarioDefinition(**item) for item in payload["training_scenarios"]]
    shadow_scenarios = [ScenarioDefinition(**item) for item in payload["shadow_scenarios"]]
    provider = context.network_provider()
    training_result = execute_permutations(model, training_scenarios, provider)
    training_outcomes = [PhysicsOutcome(**item) for item in training_result["outcomes"]]
    requested = float(payload["requested_import_mw"])
    for item in training_outcomes:
        item.features["requested_import_mw"] = requested

    def solve_shadow(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
        context.checkpoint()
        result = execute_permutations(model, items, provider)
        return [PhysicsOutcome(**item) for item in result["outcomes"]]

    report = run_release3(
        training_outcomes=training_outcomes,
        shadow_scenarios=shadow_scenarios,
        solve_shadow=solve_shadow,
        requested_import_mw=requested,
        mandatory_contingencies=set(payload.get("mandatory_contingencies", [])),
        operator_reviewed=bool(payload.get("operator_reviewed", False)),
        operator_training_authorized=bool(payload.get("operator_training_authorized", False)),
    )
    context.checkpoint()
    report["ledger_publication"] = context.publisher.shadow(job, report)
    return report
