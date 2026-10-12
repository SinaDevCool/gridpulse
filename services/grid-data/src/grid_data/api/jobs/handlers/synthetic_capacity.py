from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.synthetic_capacity import screen_synthetic_capacity


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    result = screen_synthetic_capacity(job.input_payload)
    return result
