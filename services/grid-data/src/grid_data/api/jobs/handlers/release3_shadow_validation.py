from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.network_study import NetworkModelInput, PandapowerProvider
from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition
from grid_data.p1_permutation import execute_permutations
from grid_data.release3_pipeline import run_release3
from grid_data.release3_publish import publish_release3


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    payload = job.input_payload
    model = NetworkModelInput(**payload["network_model"])
    training_scenarios = [ScenarioDefinition(**item) for item in payload["training_scenarios"]]
    shadow_scenarios = [ScenarioDefinition(**item) for item in payload["shadow_scenarios"]]
    provider = PandapowerProvider()
    training_result = execute_permutations(model, training_scenarios, provider)
    training_outcomes = [PhysicsOutcome(**item) for item in training_result["outcomes"]]
    requested = float(payload["requested_import_mw"])
    for item in training_outcomes:
        item.features["requested_import_mw"] = requested

    def solve_shadow(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
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
    report["ledger_publication"] = publish_release3(
        job=job,
        report=report,
        supabase_url=context.supabase_url,
        service_role_key=context.service_role_key,
    )
    return report
