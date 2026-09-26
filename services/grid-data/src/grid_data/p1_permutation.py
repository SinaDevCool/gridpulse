"""P1 deterministic, cached scenario execution over the existing physics boundary."""

from __future__ import annotations

import copy
from collections import Counter
from collections.abc import Iterable
from dataclasses import asdict, replace
from typing import Any, Protocol, TypedDict

from .network_state import NetworkStateBuilder
from .network_study import NetworkModelInput, NetworkStudyProvider
from .p0_foundation import PhysicsOutcome, ScenarioDefinition, canonical_hash, provenance_manifest


class ResultStore(Protocol):
    def get(self, key: str) -> PhysicsOutcome | None: ...
    def put(self, key: str, value: PhysicsOutcome) -> None: ...


class MemoryResultStore:
    def __init__(self) -> None:
        self.values: dict[str, PhysicsOutcome] = {}

    def get(self, key: str) -> PhysicsOutcome | None:
        return self.values.get(key)

    def put(self, key: str, value: PhysicsOutcome) -> None:
        self.values[key] = value


class PermutationRunResult(TypedDict):
    schema_version: str
    scenario_count: int
    solved_count: int
    cache_hits: int
    failure_count: int
    firm_import_capacity_mw: float | None
    binding_constraint_frequency: dict[str, int]
    worst_case: dict[str, Any] | None
    outcomes: list[dict[str, Any]]
    quarantine: list[dict[str, Any]]
    network_state_manifests: list[dict[str, Any]]
    provenance: dict[str, Any]


def generate_permutations(
    dimensions: dict[str, list], *, prefix: str = "case"
) -> list[ScenarioDefinition]:
    """Generate deterministic Cartesian permutations and remove impossible duplicates."""
    keys = sorted(dimensions)
    rows: list[dict] = [{}]
    for key in keys:
        rows = [{**row, key: value} for row in rows for value in dimensions[key]]
    scenarios = []
    for row in rows:
        if row.get("switching_state") == "normal" and row.get("contingency_id") not in (None, ""):
            continue
        digest = canonical_hash(row)[:16]
        scenarios.append(ScenarioDefinition(scenario_id=f"{prefix}-{digest}", **row))
    return sorted(scenarios, key=lambda item: item.input_hash)


def _apply(model: NetworkModelInput, scenario: ScenarioDefinition) -> NetworkModelInput:
    if (
        scenario.switching_state != "normal"
        or scenario.reinforcement_ids
        or scenario.queue_project_ids
        or scenario.battery_dispatch_mw
        or scenario.flexible_load_reduction_mw
    ):
        raise ValueError(
            "This scenario requires a NetworkStateBuilder backed by a validated pilot dataset."
        )
    loads = [
        {**item, "p_mw": float(item.get("p_mw", 0)) * scenario.demand_factor}
        for item in copy.deepcopy(model.loads)
    ]
    generators = []
    for item in copy.deepcopy(model.generators):
        generators.append(
            item
            if item.get("slack") or item.get("kind") == "external_grid"
            else {**item, "p_mw": float(item.get("p_mw", 0)) * scenario.renewable_factor}
        )
    if scenario.accepted_connections_mw:
        loads.append(
            {
                "id": f"queue-{scenario.scenario_id}",
                "bus": model.connection_bus,
                "p_mw": scenario.accepted_connections_mw,
                "q_mvar": 0.0,
            }
        )
    contingencies = model.contingencies
    if scenario.contingency_id:
        contingencies = [
            item for item in model.contingencies if str(item.get("id")) == scenario.contingency_id
        ]
        if not contingencies:
            raise ValueError(f"Unknown contingency {scenario.contingency_id}")
    return replace(
        model, loads=loads, generators=generators, contingencies=copy.deepcopy(contingencies)
    )


def execute_permutations(
    model: NetworkModelInput,
    scenarios: Iterable[ScenarioDefinition],
    provider: NetworkStudyProvider,
    *,
    store: ResultStore | None = None,
    state_builder: NetworkStateBuilder | None = None,
    cancel_check=lambda: False,
) -> PermutationRunResult:
    store = store or MemoryResultStore()
    outcomes: list[PhysicsOutcome] = []
    failures: list[dict] = []
    state_manifests: list[dict] = []
    cache_hits = 0
    for scenario in sorted(scenarios, key=lambda item: item.input_hash):
        if cancel_check():
            break
        key = canonical_hash(
            {
                "model": model.model_id,
                "version": model.model_version,
                "scenario": scenario.input_hash,
            }
        )
        cached = store.get(key)
        if cached:
            outcomes.append(cached)
            if state_builder:
                state_manifests.append(state_builder.manifest(scenario))
            cache_hits += 1
            continue
        try:
            case_model = state_builder.build(scenario) if state_builder else _apply(model, scenario)
            if state_builder:
                state_manifests.append(state_builder.manifest(scenario, case_model))
            imp = provider.calculate_import_capacity(case_model)
            exp = provider.calculate_export_capacity(case_model)
            iv, ev = imp.values, exp.values
            outcome = PhysicsOutcome(
                scenario_id=scenario.scenario_id,
                input_hash=scenario.input_hash,
                import_capacity_mw=iv.get("firm_import_capacity_mw"),
                export_capacity_mw=ev.get("firm_export_capacity_mw"),
                feasible=bool(imp.converged and exp.converged),
                binding_case=iv.get("binding_case"),
                binding_constraint=iv.get("binding_constraint"),
                solver=imp.provider,
                solver_version=imp.solver_version,
                validation_class=model.validation_class,
                physics_verified=bool(imp.converged and exp.converged),
                limitations=tuple(imp.limitations),
                features={
                    "demand_factor": scenario.demand_factor,
                    "renewable_factor": scenario.renewable_factor,
                    "accepted_connections_mw": scenario.accepted_connections_mw,
                    "reinforcement_delay_years": float(scenario.reinforcement_delay_years),
                    "battery_dispatch_mw": scenario.battery_dispatch_mw,
                    "flexible_load_reduction_mw": scenario.flexible_load_reduction_mw,
                    "battery_availability": scenario.battery_availability,
                    "flexible_load_availability": scenario.flexible_load_availability,
                    "contingency_present": float(bool(scenario.contingency_id)),
                    "switching_changed": float(scenario.switching_state != "normal"),
                    "queue_project_count": float(len(scenario.queue_project_ids)),
                    "reinforcement_count": float(len(scenario.reinforcement_ids)),
                },
            )
            outcome.validate_for_display()
            store.put(key, outcome)
            outcomes.append(outcome)
        except Exception as error:  # noqa: BLE001 - quarantine isolates a failed solver case
            failures.append(
                {
                    "scenario_id": scenario.scenario_id,
                    "input_hash": scenario.input_hash,
                    "error": type(error).__name__,
                    "message": str(error)[:500],
                }
            )
    verified = [
        item for item in outcomes if item.physics_verified and item.import_capacity_mw is not None
    ]
    constraints = Counter(item.binding_constraint or "unknown" for item in verified)
    firm = min((item.import_capacity_mw for item in verified), default=None)
    worst = min(verified, key=lambda item: item.import_capacity_mw) if verified else None
    return {
        "schema_version": "gridpulse-p1-permutation-v1",
        "scenario_count": len(outcomes) + len(failures),
        "solved_count": len(outcomes) - cache_hits,
        "cache_hits": cache_hits,
        "failure_count": len(failures),
        "firm_import_capacity_mw": firm,
        "binding_constraint_frequency": dict(constraints),
        "worst_case": asdict(worst) if worst else None,
        "outcomes": [asdict(item) for item in outcomes],
        "quarantine": failures,
        "network_state_manifests": state_manifests,
        "provenance": provenance_manifest(
            model_id=model.model_id,
            model_version=model.model_version,
            dataset_hash=canonical_hash([item.input_hash for item in outcomes]),
            validation_class=model.validation_class,
        ),
    }
