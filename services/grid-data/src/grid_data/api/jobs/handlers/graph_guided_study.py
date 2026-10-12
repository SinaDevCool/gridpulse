from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.graph.pipeline import run_graph_guided_study
from grid_data.graph.publish import publish_graph_study
from grid_data.network_study import NetworkModelInput
from grid_data.p0_foundation import ScenarioDefinition


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    payload = job.input_payload
    report = run_graph_guided_study(
        model=NetworkModelInput(**payload["network_model"]),
        scenarios=[ScenarioDefinition(**row) for row in payload["scenarios"]],
        source_bus=payload["source_bus"],
        target_buses=payload["target_buses"],
        mandatory_contingencies=set(payload.get("mandatory_contingencies", [])),
        budget=int(payload["solver_budget"]),
        validation_mode=str(payload.get("validation_mode", "qualification")),
        reduction_policy=payload.get("reduction_policy"),
    )
    report["ledger_publication"] = publish_graph_study(job=job, report=report)
    return report
