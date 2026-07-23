from __future__ import annotations

from typing import Any

OPTIMIZER_VERSION = "flexibility-candidate-ranking-v1"


def rank_operating_envelopes(payload: dict[str, Any]) -> dict[str, Any]:
    demand = [max(0.0, float(value)) for value in payload.get("demand_mw", [])]
    candidates = payload.get("candidates", [])
    if not demand:
        raise ValueError("At least one demand interval is required.")
    if not candidates:
        raise ValueError("At least one supplied operating envelope is required.")
    critical = max(0.0, float(payload.get("minimum_critical_load_mw", 0)))
    shiftable = max(0.0, float(payload.get("shiftable_load_mw", 0)))
    battery_power = max(0.0, float(payload.get("battery_power_mw", 0)))
    battery_energy = max(0.0, float(payload.get("battery_usable_energy_mwh", 0)))
    interval_hours = float(payload.get("interval_minutes", 15)) / 60
    value_eur_mwh = max(0.0, float(payload.get("energy_value_eur_mwh", 0)))
    ranked: list[dict[str, Any]] = []

    for candidate in candidates:
        firm = max(0.0, float(candidate.get("firm_import_mw", 0)))
        conditional = max(0.0, float(candidate.get("conditional_import_mw", 0)))
        remaining_battery = battery_energy
        residual_mwh = 0.0
        critical_breaches = 0
        restricted_intervals = 0
        for baseline in demand:
            limit = firm + conditional
            required = max(0.0, baseline - limit)
            if required:
                restricted_intervals += 1
            workload_response = min(required, shiftable)
            remaining = required - workload_response
            battery_response = min(
                remaining,
                battery_power,
                remaining_battery / interval_hours if interval_hours else 0,
            )
            remaining_battery -= battery_response * interval_hours
            residual_mwh += (remaining - battery_response) * interval_hours
            served = baseline - remaining + battery_response
            if served < critical:
                critical_breaches += 1
        feasible = critical_breaches == 0 and residual_mwh == 0
        ranked.append(
            {
                "candidate_id": str(candidate.get("id", "")),
                "firm_import_mw": firm,
                "conditional_import_mw": conditional,
                "feasible_on_declared_inputs": feasible,
                "critical_breach_intervals": critical_breaches,
                "restricted_intervals": restricted_intervals,
                "residual_unserved_mwh": round(residual_mwh, 3),
                "commercial_exposure_eur": round(residual_mwh * value_eur_mwh, 2),
            }
        )
    ranked.sort(
        key=lambda item: (
            not item["feasible_on_declared_inputs"],
            item["commercial_exposure_eur"],
            item["firm_import_mw"],
        )
    )
    return {
        "methodology_version": OPTIMIZER_VERSION,
        "classification": "customer_side_candidate_ranking",
        "selected_candidate_id": ranked[0]["candidate_id"],
        "ranked_candidates": ranked,
        "limitations": [
            "Ranks only supplied operating envelopes; it does not create network capacity.",
            "Battery dispatch is a deterministic single-horizon screening approximation.",
            "Operator validation and detailed engineering remain required.",
        ],
    }
