from __future__ import annotations

import hashlib
import math
from typing import Any

SCENARIO_VERSION = "de-bb-synthetic-capacity-v1"
MODEL_VERSION = "deterministic-hourly-profile-v1"


def _seed(node_id: str) -> float:
    digest = hashlib.sha256(f"{SCENARIO_VERSION}:{node_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / ((1 << 64) - 1)


def _rating(voltage_kv: float, seed: float) -> float:
    midpoint = (
        650 if voltage_kv >= 380 else 320 if voltage_kv >= 220 else 120 if voltage_kv >= 110 else 28
    )
    return midpoint * (0.78 + seed * 0.44)


def screen_synthetic_capacity(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic Release A scenario; never represents operator-confirmed capacity."""
    node_id = str(payload.get("node_id", "")).strip()
    if not node_id:
        raise ValueError("node_id is required")
    voltage_kv = max(20.0, float(payload.get("voltage_kv", 20)))
    requested = max(0.1, float(payload.get("requested_import_mw", 0)))
    target_year = min(2050, max(2026, int(payload.get("target_energisation_year", 2028))))
    redundancy = str(payload.get("redundancy", "single_feed"))
    seed = _seed(node_id)
    rating = _rating(voltage_kv, seed) * max(0.72, 1 - (target_year - 2026) * 0.01)
    contingency_factor = {
        "n_minus_one": 0.48 + seed * 0.12,
        "dual_feed": 0.55 + seed * 0.14,
    }.get(redundancy, 0.68 + seed * 0.16)
    limits = {
        "transformer": rating * (0.58 + seed * 0.16),
        "upstream_branch": rating * (0.62 + ((seed * 7) % 1) * 0.18),
        "voltage_security": rating * (0.55 + ((seed * 13) % 1) * 0.20),
        "contingency": rating * contingency_factor,
    }
    limiting_component = min(limits, key=limits.get)  # type: ignore[arg-type]
    firm = min(limits.values())
    ceiling = min(rating * 0.92, firm * (1.2 + seed * 0.25))
    hourly = []
    constrained = 0
    for hour in range(8760):
        hour_of_day = hour % 24
        seasonal = 0.91 + 0.07 * math.sin((hour / 8760) * math.pi * 2 + seed * 4)
        evening = 0.88 if 17 <= hour_of_day < 21 else 1.0
        available = min(ceiling, firm * seasonal * evening * (1.08 + seed * 0.08))
        hourly.append(available)
        if requested > available:
            constrained += 1
    hourly.sort()
    percentile = lambda p: hourly[int((len(hourly) - 1) * p)]
    return {
        "classification": "synthetic_capacity_scenario",
        "evidence_status": "synthetic",
        "training_status": "untrained",
        "not_for_connection_decision": True,
        "scenario_version": SCENARIO_VERSION,
        "model_version": MODEL_VERSION,
        "node_id": node_id,
        "requested_import_mw": round(requested, 1),
        "firm_import_envelope_mw": round(firm, 1),
        "flexible_import_envelope_mw": round(percentile(0.5), 1),
        "p10_flexible_envelope_mw": round(percentile(0.1), 1),
        "p90_flexible_envelope_mw": round(percentile(0.9), 1),
        "constrained_hours_per_year": constrained,
        "limiting_component": limiting_component,
        "replacement_target": "DSO/TSO planning model and operational data",
        "limitations": [
            "No operator ratings, loading, security criteria or connection queue are used.",
            "The result is not available or connectable capacity.",
        ],
    }
