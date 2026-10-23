from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.api.jobs.isolated_facility import execute_isolated_facility


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    return execute_isolated_facility(context, job.input_payload)
