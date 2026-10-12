from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    from capacity_backtest.application import run_rolling_facility_plan

    result = run_rolling_facility_plan(job.input_payload)
    return result
