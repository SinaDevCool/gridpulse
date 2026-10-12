from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    from capacity_backtest.application import run_facility_uncertainty

    result = run_facility_uncertainty(job.input_payload)
    return result
