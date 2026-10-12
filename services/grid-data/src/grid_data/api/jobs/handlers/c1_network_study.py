from __future__ import annotations

from dataclasses import asdict

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.network_study import NetworkModelInput


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    model = NetworkModelInput(**job.input_payload)
    provider = context.network_provider()
    results = [
        asdict(provider.run_base_case(model)),
        asdict(provider.run_voltage_assessment(model)),
        asdict(provider.run_contingency_analysis(model)),
        asdict(provider.calculate_import_capacity(model)),
    ]
    return {
        "schema_version": "gridpulse-c1-study-v1",
        "model_id": model.model_id,
        "model_version": model.model_version,
        "validation_class": model.validation_class,
        "results": results,
    }
