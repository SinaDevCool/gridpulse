"""P0 contracts shared by the permutation, ensemble and surrogate pipeline."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

PIPELINE_VERSION = "gridpulse-permutation-pipeline-v1"
ValidationClass = Literal[
    "synthetic_demonstration",
    "operator_model_unvalidated",
    "operator_model_reconciled",
    "operator_reviewed",
    "operator_confirmed",
]


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True)
class ScenarioDefinition:
    scenario_id: str
    demand_factor: float = 1.0
    renewable_factor: float = 1.0
    accepted_connections_mw: float = 0.0
    reinforcement_delay_years: int = 0
    switching_state: str = "normal"
    contingency_id: str | None = None
    planned_outage_id: str | None = None
    battery_availability: float = 1.0
    flexible_load_availability: float = 1.0
    battery_dispatch_mw: float = 0.0
    flexible_load_reduction_mw: float = 0.0
    queue_project_ids: tuple[str, ...] = ()
    reinforcement_ids: tuple[str, ...] = ()
    weather_year: int | None = None
    hour_of_year: int | None = None
    seed: int | None = None
    source_kind: Literal["historical_replay", "probabilistic", "stress", "deterministic"] = (
        "deterministic"
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        if self.demand_factor < 0 or self.renewable_factor < 0:
            raise ValueError("Demand and renewable factors must be non-negative.")
        if not 0 <= self.battery_availability <= 1 or not 0 <= self.flexible_load_availability <= 1:
            raise ValueError("Availability must be between zero and one.")
        if self.battery_dispatch_mw < 0 or self.flexible_load_reduction_mw < 0:
            raise ValueError("Dispatch and flexible-load reduction must be non-negative.")
        if self.switching_state == "normal" and self.contingency_id == "normal":
            raise ValueError("The normal state cannot also be a contingency.")

    @property
    def input_hash(self) -> str:
        self.validate()
        return canonical_hash(asdict(self))


@dataclass(frozen=True)
class PhysicsOutcome:
    scenario_id: str
    input_hash: str
    import_capacity_mw: float | None
    export_capacity_mw: float | None
    feasible: bool
    binding_case: str | None
    binding_constraint: str | None
    solver: str
    solver_version: str | None
    validation_class: ValidationClass
    physics_verified: bool
    limitations: tuple[str, ...] = ()
    features: dict[str, float] = field(default_factory=dict)

    def validate_for_display(self) -> None:
        if (
            self.import_capacity_mw is not None or self.export_capacity_mw is not None
        ) and not self.physics_verified:
            raise ValueError("A displayed capacity must be physics verified.")


def provenance_manifest(
    *, model_id: str, model_version: str, dataset_hash: str, validation_class: ValidationClass
) -> dict[str, Any]:
    return {
        "pipeline_version": PIPELINE_VERSION,
        "model_id": model_id,
        "model_version": model_version,
        "dataset_hash": dataset_hash,
        "validation_class": validation_class,
        "capacity_claim": validation_class == "operator_confirmed",
    }
