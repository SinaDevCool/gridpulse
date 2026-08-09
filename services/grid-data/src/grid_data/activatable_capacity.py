"""Governed representative activatable-capacity calculation.

The electrical ceiling is supplied by a solved network study. Hourly utilisation is
synthetic and deterministic, so this module demonstrates operating-envelope value
without claiming telemetry or capacity at public infrastructure.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any


@dataclass(frozen=True)
class ActivationPolicy:
    flexible_load_fraction: float = 0.25
    maximum_event_hours: int = 8
    battery_power_fraction: float = 0.22
    battery_duration_hours: float = 4.0
    battery_round_trip_efficiency: float = 0.90
    battery_reserve_fraction: float = 0.10


def _hourly_envelope(electrical_ceiling_mw: float, seed: int) -> list[float]:
    values: list[float] = []
    for hour in range(8760):
        day = hour // 24
        hour_of_day = hour % 24
        seasonal = 0.055 * math.cos(2 * math.pi * (day - 25) / 365)
        evening = 0.06 * math.exp(-((hour_of_day - 18) ** 2) / 14)
        working = 0.035 if hour_of_day in range(8, 18) else 0
        factor = 0.94 - seasonal - evening - working
        # Twelve deterministic six-hour stress events per reference bus.
        event_day = (17 + seed * 11 + (day // 30) * 31) % 365
        if day % 30 == event_day % 30 and 16 <= hour_of_day < 22:
            factor -= 0.24
        values.append(round(max(0.45, min(1.0, factor)) * electrical_ceiling_mw, 5))
    return values


def _events(shortfalls: list[float]) -> list[tuple[int, int]]:
    events: list[tuple[int, int]] = []
    start: int | None = None
    for index, value in enumerate([*shortfalls, 0.0]):
        if value > 1e-7 and start is None:
            start = index
        elif value <= 1e-7 and start is not None:
            events.append((start, index))
            start = None
    return events


def _battery_dispatch(
    target_mw: float, envelope: list[float], power_mw: float, energy_mwh: float,
    round_trip_efficiency: float, reserve_fraction: float,
) -> tuple[list[float], list[float]]:
    charge_efficiency = math.sqrt(round_trip_efficiency)
    discharge_efficiency = math.sqrt(round_trip_efficiency)
    minimum_soc = energy_mwh * reserve_fraction
    soc = energy_mwh
    residual: list[float] = []
    state_of_charge: list[float] = []
    for available in envelope:
        shortfall = max(0.0, target_mw - available)
        discharge = min(shortfall, power_mw, max(0.0, soc - minimum_soc) * discharge_efficiency)
        soc -= discharge / discharge_efficiency if discharge_efficiency else 0
        remaining = shortfall - discharge
        headroom = max(0.0, available - target_mw)
        charge = min(power_mw, headroom, max(0.0, energy_mwh - soc) / charge_efficiency)
        soc += charge * charge_efficiency
        residual.append(round(remaining, 5))
        state_of_charge.append(round(soc, 5))
    return residual, state_of_charge


def _summary(target_mw: float, shortfalls: list[float]) -> dict[str, Any]:
    events = _events(shortfalls)
    restricted_energy = sum(shortfalls)
    requested_energy = target_mw * len(shortfalls)
    return {
        "capacity_mw": round(target_mw, 3),
        "restricted_hours": sum(value > 1e-7 for value in shortfalls),
        "restricted_energy_mwh": round(restricted_energy, 3),
        "maximum_reduction_mw": round(max(shortfalls, default=0), 3),
        "longest_event_hours": max((end - start for start, end in events), default=0),
        "event_count": len(events),
        "demand_served_percent": round(
            100.0 if requested_energy <= 0 else 100 * (1 - restricted_energy / requested_energy), 3
        ),
    }


def calculate_activatable_capacity(
    *, result_id: str, electrical_ceiling_mw: float, n1_capacity_mw: float,
    policy: ActivationPolicy = ActivationPolicy(),
) -> dict[str, Any]:
    if electrical_ceiling_mw < 0 or n1_capacity_mw < 0:
        raise ValueError("Capacity inputs cannot be negative.")
    seed = int(hashlib.sha256(result_id.encode()).hexdigest()[:8], 16) % 997
    envelope = _hourly_envelope(electrical_ceiling_mw, seed)
    ordered = sorted(envelope)
    immediate = ordered[0]
    # The lower-tail quantile represents a managed envelope exceeded by the
    # network in 98.5% of hours, leaving a bounded set of operating events.
    flexible = ordered[int(len(ordered) * 0.015)]
    flexible_shortfall = [min(policy.flexible_load_fraction * flexible, max(0.0, flexible - value)) for value in envelope]
    battery_power = round(electrical_ceiling_mw * policy.battery_power_fraction, 3)
    battery_energy = round(battery_power * policy.battery_duration_hours, 3)
    bess_target = ordered[int(len(ordered) * 0.04)]
    bess_shortfall, soc = _battery_dispatch(
        bess_target, envelope, battery_power, battery_energy,
        policy.battery_round_trip_efficiency, policy.battery_reserve_fraction,
    )
    flex = _summary(flexible, flexible_shortfall)
    bess = _summary(bess_target, bess_shortfall)
    firm = max(0.0, min(n1_capacity_mw, electrical_ceiling_mw))
    activatable = max(firm, flexible)
    samples = []
    for hour in range(0, 8760, 52):
        samples.append({
            "timestamp": (datetime(2028, 1, 1, tzinfo=timezone.utc) + timedelta(hours=hour)).isoformat(),
            "envelope_mw": envelope[hour],
            "flexible_target_mw": round(flexible, 3),
            "bess_target_mw": round(bess_target, 3),
            "battery_soc_mwh": soc[hour],
        })
    payload = {
        "schema_version": "gridpulse-activatable-capacity-v1",
        "requested_capacity_mw": round(electrical_ceiling_mw, 3),
        "conventional_firm_mw": round(firm, 3),
        "immediately_energisable_mw": round(immediate, 3),
        "activatable_capacity_mw": round(activatable, 3),
        "additional_unlocked_mw": round(max(0.0, activatable - firm), 3),
        "flexible": flex,
        "bess_assisted": {**bess, "battery_power_mw": battery_power, "battery_energy_mwh": battery_energy},
        "staged": {
            "initial_capacity_mw": round(immediate, 3),
            "eventual_capacity_mw": round(electrical_ceiling_mw, 3),
            "representative_stage_count": 3,
        },
        "hourly": {
            "hour_count": 8760,
            "profile_class": "deterministic_synthetic_operating_envelope",
            "samples": samples,
        },
        "policy": asdict(policy),
        "calculation_boundary": "The electrical ceiling is a Pandapower result; hourly utilisation and operating commitments are representative synthetic conditions.",
    }
    payload["result_sha256"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return payload
