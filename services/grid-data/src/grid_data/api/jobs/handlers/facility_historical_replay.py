from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    if job.input_payload.get("schema_version") in {
        "gridpulse-facility-experiment-request-v1",
        "gridpulse-facility-accounting-request-v1",
        "gridpulse-facility-accounting-request-v2",
    }:
        from grid_data.api.jobs.isolated_facility import execute_isolated_facility

        return execute_isolated_facility(context, job.input_payload)
    from capacity_backtest.application import run_facility_historical_replay

    result = run_facility_historical_replay(job.input_payload)
    return result
