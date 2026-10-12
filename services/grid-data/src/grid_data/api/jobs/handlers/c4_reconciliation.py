from __future__ import annotations

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.c4_operator_pilot import ScadaObservation, reconcile_measurements


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    payload = job.input_payload
    observed = [ScadaObservation(**item) for item in payload["observed"]]
    result = reconcile_measurements(
        observed,
        payload["simulated"],
        active_power_mae_limit_mw=float(payload["active_power_mae_limit_mw"]),
        voltage_mae_limit_pu=float(payload.get("voltage_mae_limit_pu", 0.02)),
        minimum_coverage=float(payload.get("minimum_coverage", 0.95)),
    )
    return result
