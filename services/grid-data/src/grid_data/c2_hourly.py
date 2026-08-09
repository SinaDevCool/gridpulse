"""Release C2 hourly operating cases and ensemble capacity envelopes."""

from __future__ import annotations

import copy
import hashlib
import json
import math
from collections.abc import Iterable
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Any

from .network_state import NetworkStateBuilder
from .network_study import NetworkModelInput, PandapowerProvider
from .p0_foundation import ScenarioDefinition

C2_SCHEMA_VERSION = "gridpulse-c2-hourly-capacity-v2"
C2_ENGINE_VERSION = "weather-year-ac-envelope-v2"


@dataclass(frozen=True)
class HourlyOperatingCase:
    timestamp: datetime
    weather_year: int
    demand_factor: float
    renewable_factor: float
    temperature_c: float | None = None
    switching_state: str = "normal"
    planned_outage: str | None = None
    target_year: int = 2028
    accepted_connections_mw: float = 0.0
    scenario_id: str = "base"
    reinforcement_delay_years: int = 0
    queue_project_ids: tuple[str, ...] = ()
    reinforcement_ids: tuple[str, ...] = ()
    battery_availability: float = 1.0
    flexible_load_availability: float = 1.0
    battery_dispatch_mw: float = 0.0
    flexible_load_reduction_mw: float = 0.0


def _percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        raise ValueError("Cannot calculate a percentile from an empty series.")
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def build_operating_cases(
    *,
    weather_year: int,
    demand_values: Iterable[float],
    temperature_values: Iterable[float] | None = None,
    renewable_values: Iterable[float] | None = None,
    target_year: int = 2028,
    annual_growth_rate: float = 0.015,
    accepted_connections_mw: float = 0.0,
) -> list[HourlyOperatingCase]:
    demand = [float(value) for value in demand_values]
    if len(demand) not in {8760, 8784}:
        raise ValueError("A weather year must contain 8,760 or 8,784 hourly demand values.")
    temperatures = (
        list(temperature_values) if temperature_values is not None else [None] * len(demand)
    )
    renewables = list(renewable_values) if renewable_values is not None else [0.0] * len(demand)
    if len(temperatures) != len(demand) or len(renewables) != len(demand):
        raise ValueError("Demand, temperature and renewable series must have equal length.")
    median_demand = max(_percentile(demand, 0.5), 1e-6)
    max_renewable = max([abs(float(value)) for value in renewables] or [1.0]) or 1.0
    growth = (1 + annual_growth_rate) ** max(0, target_year - weather_year)
    start = datetime(weather_year, 1, 1, tzinfo=timezone.utc)
    return [
        HourlyOperatingCase(
            timestamp=start + timedelta(hours=index),
            weather_year=weather_year,
            demand_factor=max(0.05, value / median_demand) * growth,
            renewable_factor=max(0.0, float(renewables[index]) / max_renewable),
            temperature_c=None if temperatures[index] is None else float(temperatures[index]),
            target_year=target_year,
            accepted_connections_mw=accepted_connections_mw,
        )
        for index, value in enumerate(demand)
    ]


def _case_model(model: NetworkModelInput, case: HourlyOperatingCase) -> NetworkModelInput:
    loads = []
    for load in model.loads:
        updated = copy.deepcopy(load)
        updated["p_mw"] = float(load.get("p_mw", 0)) * case.demand_factor
        updated["q_mvar"] = float(load.get("q_mvar", 0)) * case.demand_factor
        loads.append(updated)
    if case.accepted_connections_mw:
        loads.append(
            {
                "id": "c2-accepted-connections",
                "bus": model.connection_bus,
                "p_mw": case.accepted_connections_mw,
                "q_mvar": 0.0,
            }
        )
    generators = []
    for generator in model.generators:
        updated = copy.deepcopy(generator)
        if not (generator.get("slack") or generator.get("kind") == "external_grid"):
            updated["p_mw"] = float(generator.get("p_mw", 0)) * case.renewable_factor
            updated["q_mvar"] = float(generator.get("q_mvar", 0)) * case.renewable_factor
        generators.append(updated)
    contingencies = model.contingencies
    if case.planned_outage:
        contingencies = [
            item for item in model.contingencies if item.get("id") == case.planned_outage
        ]
    return replace(
        model,
        loads=loads,
        generators=generators,
        contingencies=contingencies,
        study_year=case.target_year,
    )


def calculate_hourly_envelopes(
    model: NetworkModelInput,
    cases: list[HourlyOperatingCase],
    *,
    requested_import_mw: float,
    provider: PandapowerProvider | None = None,
    state_builder: NetworkStateBuilder | None = None,
    factor_precision: int = 2,
) -> dict[str, Any]:
    """Solve unique operating states and map the AC results back to every hour."""
    if not cases:
        raise ValueError("At least one hourly operating case is required.")
    solver = provider or PandapowerProvider(maximum_capacity_mw=max(100, requested_import_mw * 2))
    cache: dict[tuple[Any, ...], dict[str, Any]] = {}
    hourly: list[dict[str, Any]] = []
    for case in cases:
        key = (
            round(case.demand_factor, factor_precision),
            round(case.renewable_factor, factor_precision),
            case.switching_state,
            case.planned_outage,
            round(case.accepted_connections_mw, 2),
            case.target_year,
            case.scenario_id,
            case.reinforcement_delay_years,
            case.queue_project_ids,
            case.reinforcement_ids,
            round(case.battery_dispatch_mw, 3),
            round(case.flexible_load_reduction_mw, 3),
        )
        result = cache.get(key)
        if result is None:
            case_model = (
                state_builder.build(
                    ScenarioDefinition(
                        scenario_id=case.scenario_id,
                        demand_factor=case.demand_factor,
                        renewable_factor=case.renewable_factor,
                        accepted_connections_mw=case.accepted_connections_mw,
                        reinforcement_delay_years=case.reinforcement_delay_years,
                        switching_state=case.switching_state,
                        contingency_id=case.planned_outage,
                        battery_availability=case.battery_availability,
                        flexible_load_availability=case.flexible_load_availability,
                        battery_dispatch_mw=case.battery_dispatch_mw,
                        flexible_load_reduction_mw=case.flexible_load_reduction_mw,
                        queue_project_ids=case.queue_project_ids,
                        reinforcement_ids=case.reinforcement_ids,
                        weather_year=case.weather_year,
                        hour_of_year=(case.timestamp.timetuple().tm_yday - 1) * 24
                        + case.timestamp.hour,
                    )
                )
                if state_builder
                else _case_model(model, case)
            )
            capacity = solver.calculate_import_capacity(case_model)
            result = {
                "capacity_mw": float(capacity.values["firm_import_capacity_mw"]),
                "binding_case": capacity.values["binding_case"],
                "binding_constraint": capacity.values["binding_constraint"],
                "converged": bool(capacity.converged),
            }
            cache[key] = result
        hourly.append(
            {
                "timestamp": case.timestamp.isoformat(),
                "weather_year": case.weather_year,
                "capacity_mw": result["capacity_mw"],
                "constrained": requested_import_mw > result["capacity_mw"],
                "curtailment_mw": round(max(0.0, requested_import_mw - result["capacity_mw"]), 3),
                "binding_case": result["binding_case"],
                "binding_constraint": result["binding_constraint"],
            }
        )
    capacities = [item["capacity_mw"] for item in hourly]
    curtailments = [item["curtailment_mw"] for item in hourly]
    constraints: dict[str, int] = {}
    for item in hourly:
        label = f"{item['binding_case']}:{item['binding_constraint']}"
        constraints[label] = constraints.get(label, 0) + 1
    canonical = json.dumps([asdict(case) for case in cases], default=str, sort_keys=True)
    worst = max(hourly, key=lambda item: (item["curtailment_mw"], -item["capacity_mw"]))
    return {
        "schema_version": C2_SCHEMA_VERSION,
        "engine_version": C2_ENGINE_VERSION,
        "validation_class": model.validation_class,
        "model_id": model.model_id,
        "model_version": model.model_version,
        "target_year": cases[0].target_year,
        "weather_years": sorted({case.weather_year for case in cases}),
        "requested_import_mw": requested_import_mw,
        "hour_count": len(hourly),
        "unique_operating_states_solved": len(cache),
        "p10_capacity_mw": round(_percentile(capacities, 0.1), 3),
        "p50_capacity_mw": round(_percentile(capacities, 0.5), 3),
        "p90_capacity_mw": round(_percentile(capacities, 0.9), 3),
        "percentile_semantics": {
            "variable": "simulated hourly import-capacity envelope",
            "ordering": "ascending",
            "p10": "10% of simulated hours have capacity at or below this value",
            "p50": "median simulated hourly capacity",
            "p90": "90% of simulated hours have capacity at or below this value; this is an upper, not conservative, percentile",
            "firm_screening_value": "minimum_capacity_mw",
        },
        "minimum_capacity_mw": round(min(capacities), 3),
        "maximum_capacity_mw": round(max(capacities), 3),
        "constrained_hours": sum(bool(item["constrained"]) for item in hourly),
        "maximum_curtailment_mw": round(max(curtailments), 3),
        "expected_curtailed_mwh": round(sum(curtailments), 3),
        "binding_constraint_frequency": constraints,
        "worst_simulated_condition": worst,
        "ensemble_manifest": {
            "scenario_ids": sorted({case.scenario_id for case in cases}),
            "weather_years": sorted({case.weather_year for case in cases}),
            "target_years": sorted({case.target_year for case in cases}),
            "reinforcement_delay_years": sorted({case.reinforcement_delay_years for case in cases}),
            "case_count": len(cases),
            "factor_precision": factor_precision,
        },
        "input_sha256": hashlib.sha256(canonical.encode()).hexdigest(),
        "hourly": hourly,
        "limitations": [
            "C2 envelopes inherit the electrical model validation class.",
            "SMARD is national/system context and DWD is weather context; neither is feeder SCADA.",
            "MaStR capacities are registered-asset context, not local dispatch or headroom.",
            "Only operator-reviewed or operator-confirmed models can support location claims.",
        ],
    }
