from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    from capacity_backtest.application import run_capacity_requirement

    result = run_capacity_requirement(job.input_payload)
    return result
