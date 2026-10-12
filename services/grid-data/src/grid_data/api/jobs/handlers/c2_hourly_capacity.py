from __future__ import annotations

from datetime import datetime

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.c2_hourly import HourlyOperatingCase, calculate_hourly_envelopes
from grid_data.network_study import NetworkModelInput


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    payload = dict(job.input_payload)
    cases = [
        HourlyOperatingCase(
            **{
                **item,
                "timestamp": datetime.fromisoformat(str(item["timestamp"]).replace("Z", "+00:00")),
            }
        )
        for item in payload.pop("hourly_cases")
    ]
    requested = float(payload.pop("requested_import_mw"))
    payload.pop("target_year", None)
    model = NetworkModelInput(**payload)
    result = calculate_hourly_envelopes(model, cases, requested_import_mw=requested)
    return result
