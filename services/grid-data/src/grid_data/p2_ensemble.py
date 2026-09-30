"""P2 correlated German-context ensemble construction and uncertainty summaries."""

from __future__ import annotations

import math
import random
from collections import Counter
from statistics import mean

from .p0_foundation import PhysicsOutcome, ScenarioDefinition, canonical_hash


def historical_replay(rows: list[dict], *, weather_years: set[int]) -> list[ScenarioDefinition]:
    """Replay whole observed rows, preserving demand/weather/renewable correlation."""
    selected = [row for row in rows if int(row["weather_year"]) in weather_years]
    if len({int(row["weather_year"]) for row in selected}) < 3:
        raise ValueError("P2 requires at least three weather years.")
    return [
        ScenarioDefinition(
            scenario_id=f"history-{canonical_hash(row)[:16]}",
            weather_year=int(row["weather_year"]),
            hour_of_year=int(row["hour_of_year"]),
            demand_factor=float(row["demand_factor"]),
            renewable_factor=float(row["renewable_factor"]),
            accepted_connections_mw=float(row.get("accepted_connections_mw", 0)),
            source_kind="historical_replay",
            metadata={"source_refs": row.get("source_refs", [])},
        )
        for row in selected
    ]


def correlated_monte_carlo(
    rows: list[dict], *, samples: int, seed: int
) -> list[ScenarioDefinition]:
    """Block bootstrap observed correlated states, then perturb bounded future variables."""
    if not rows:
        raise ValueError("Historical rows are required.")
    rng = random.Random(seed)
    result = []
    for index in range(samples):
        base = rows[rng.randrange(len(rows))]
        queue = max(
            0.0,
            rng.gauss(
                float(base.get("accepted_connections_mw", 0)),
                max(1.0, float(base.get("queue_sigma_mw", 5))),
            ),
        )
        delay = max(0, min(8, round(rng.triangular(0, 8, 2))))
        result.append(
            ScenarioDefinition(
                scenario_id=f"mc-{seed}-{index:07d}",
                demand_factor=max(0, float(base["demand_factor"]) * rng.lognormvariate(0, 0.04)),
                renewable_factor=max(
                    0, float(base["renewable_factor"]) * rng.lognormvariate(0, 0.08)
                ),
                accepted_connections_mw=queue,
                reinforcement_delay_years=delay,
                battery_availability=1.0 if rng.random() > 0.03 else 0.0,
                flexible_load_availability=1.0 if rng.random() > 0.05 else 0.5,
                weather_year=int(base["weather_year"]),
                hour_of_year=int(base["hour_of_year"]),
                seed=seed + index,
                source_kind="probabilistic",
                metadata={"sampling": "correlated-row-block-bootstrap"},
            )
        )
    return result


def stress_scenarios() -> list[ScenarioDefinition]:
    values = [
        ("winter-peak-low-wind", 1.25, 0.1, 1.0),
        ("high-renewable-export", 0.7, 1.45, 1.0),
        ("flex-unavailable", 1.1, 0.4, 0.0),
    ]
    return [
        ScenarioDefinition(
            scenario_id=name,
            demand_factor=demand,
            renewable_factor=renewable,
            battery_availability=availability,
            flexible_load_availability=availability,
            source_kind="stress",
        )
        for name, demand, renewable, availability in values
    ]


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile
    low = math.floor(position)
    high = math.ceil(position)
    return round(
        ordered[low]
        if low == high
        else ordered[low] + (ordered[high] - ordered[low]) * (position - low),
        3,
    )


def summarize_uncertainty(outcomes: list[PhysicsOutcome], *, requested_import_mw: float) -> dict:
    verified = [
        item for item in outcomes if item.physics_verified and item.import_capacity_mw is not None
    ]
    capacities = [float(item.import_capacity_mw) for item in verified]
    constrained = [max(0.0, requested_import_mw - value) for value in capacities]
    counts = Counter(item.binding_constraint or "unknown" for item in verified)
    return {
        "schema_version": "gridpulse-p2-ensemble-v1",
        "sample_count": len(outcomes),
        "verified_sample_count": len(verified),
        "coverage": round(len(verified) / len(outcomes), 6) if outcomes else 0,
        "minimum_capacity_mw": min(capacities, default=None),
        "p10_capacity_mw": _percentile(capacities, 0.1),
        "p50_capacity_mw": _percentile(capacities, 0.5),
        "p90_capacity_mw": _percentile(capacities, 0.9),
        "constrained_hours": sum(value > 0 for value in constrained),
        "indicative_curtailed_mwh": round(sum(constrained), 3),
        "mean_capacity_mw": round(mean(capacities), 3) if capacities else None,
        "binding_probabilities": {
            key: round(value / len(verified), 6) for key, value in counts.items()
        }
        if verified
        else {},
        "validation_class": verified[0].validation_class if verified else "synthetic_demonstration",
        "warning": "An ensemble distribution is not available or operator-confirmed capacity.",
    }


def convergence(previous: dict, current: dict, *, tolerance_mw: float = 0.5) -> dict:
    fields = ("p10_capacity_mw", "p50_capacity_mw", "p90_capacity_mw")
    deltas = {
        field: abs(float(current[field]) - float(previous[field]))
        for field in fields
        if current.get(field) is not None and previous.get(field) is not None
    }
    return {
        "stable": len(deltas) == len(fields)
        and max(deltas.values(), default=float("inf")) <= tolerance_mw,
        "deltas_mw": deltas,
        "tolerance_mw": tolerance_mw,
    }
