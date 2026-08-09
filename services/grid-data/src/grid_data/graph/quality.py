from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from grid_data.p0_foundation import canonical_hash


@dataclass(frozen=True)
class QualityPolicy:
    minimum_parameter_completeness: float = 0.98
    maximum_orphan_ratio: float = 0.0
    maximum_voltage_mae_pu: float = 0.02
    maximum_active_power_mae_mw: float = 2.0
    minimum_observation_coverage: float = 0.95


def evaluate_operational_quality(
    *,
    parameter_completeness: float,
    orphan_ratio: float,
    voltage_errors_pu: list[float],
    active_power_errors_mw: list[float],
    observation_coverage: float,
    policy: QualityPolicy | None = None,
) -> dict[str, Any]:
    policy = policy or QualityPolicy()
    if (
        not 0 <= parameter_completeness <= 1
        or not 0 <= orphan_ratio <= 1
        or not 0 <= observation_coverage <= 1
    ):
        raise ValueError("Completeness, orphan ratio and coverage must be between zero and one.")
    values = [
        parameter_completeness,
        orphan_ratio,
        observation_coverage,
        *voltage_errors_pu,
        *active_power_errors_mw,
    ]
    if not all(math.isfinite(value) for value in values):
        raise ValueError("Quality metrics must be finite.")
    voltage_mae = (
        sum(abs(value) for value in voltage_errors_pu) / len(voltage_errors_pu)
        if voltage_errors_pu
        else math.inf
    )
    power_mae = (
        sum(abs(value) for value in active_power_errors_mw) / len(active_power_errors_mw)
        if active_power_errors_mw
        else math.inf
    )
    checks = {
        "parameter_completeness": parameter_completeness >= policy.minimum_parameter_completeness,
        "orphan_ratio": orphan_ratio <= policy.maximum_orphan_ratio,
        "voltage_mae": voltage_mae <= policy.maximum_voltage_mae_pu,
        "active_power_mae": power_mae <= policy.maximum_active_power_mae_mw,
        "observation_coverage": observation_coverage >= policy.minimum_observation_coverage,
    }
    payload = {
        "metrics": {
            "parameter_completeness": parameter_completeness,
            "orphan_ratio": orphan_ratio,
            "voltage_mae_pu": voltage_mae,
            "active_power_mae_mw": power_mae,
            "observation_coverage": observation_coverage,
        },
        "checks": checks,
        "accepted": all(checks.values()),
    }
    return {
        **payload,
        "quality_sha256": canonical_hash(payload),
        "invalidate_physics_results": not payload["accepted"],
    }
