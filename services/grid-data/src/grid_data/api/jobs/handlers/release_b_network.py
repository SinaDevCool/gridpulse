from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.release_b_network import screen_release_b_network


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    result = screen_release_b_network(job.input_payload)
    return result
