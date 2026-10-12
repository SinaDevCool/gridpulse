from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.network_model import screen_reference_topology


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    result = screen_reference_topology(job.input_payload)
    return result
