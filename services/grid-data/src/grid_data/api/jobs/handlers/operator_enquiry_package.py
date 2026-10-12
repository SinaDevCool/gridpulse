from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    from capacity_backtest.application import run_evidence_package

    result = run_evidence_package(job.input_payload)
    return result
