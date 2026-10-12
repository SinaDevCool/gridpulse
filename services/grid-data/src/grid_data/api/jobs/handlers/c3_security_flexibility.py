from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.c3_security_flexibility import run_c3_assessment


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    result = run_c3_assessment(job.input_payload)
    return result
