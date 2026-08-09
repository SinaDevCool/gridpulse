from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AnalyticsJob(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    owner_id: UUID
    job_type: str
    status: JobStatus = JobStatus.QUEUED
    input_payload: dict[str, Any] = Field(default_factory=dict)
    result_payload: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    attempt_count: int = 0
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None
    heartbeat_at: datetime | None = None
    checkpoint_payload: dict[str, Any] = Field(default_factory=dict)
    cancellation_requested: bool = False


class JobAccepted(BaseModel):
    job_id: UUID
    status: JobStatus


class ReferenceTopologyRequest(BaseModel):
    source_node_id: str
    target_node_id: str
    nodes: list[dict[str, Any]] = Field(min_length=2, max_length=100_000)
    edges: list[dict[str, Any]] = Field(max_length=250_000)
    lineage: dict[str, Any] = Field(default_factory=dict)


class FlexibilityOptimizationRequest(BaseModel):
    demand_mw: list[float] = Field(min_length=1, max_length=35_040)
    candidates: list[dict[str, Any]] = Field(min_length=1, max_length=100)
    minimum_critical_load_mw: float = Field(ge=0)
    shiftable_load_mw: float = Field(default=0, ge=0)
    battery_power_mw: float = Field(default=0, ge=0)
    battery_usable_energy_mwh: float = Field(default=0, ge=0)
    interval_minutes: int = Field(default=15, ge=1, le=60)
    energy_value_eur_mwh: float = Field(default=0, ge=0)


class SyntheticCapacityRequest(BaseModel):
    node_id: str = Field(min_length=1, max_length=200)
    voltage_kv: float = Field(ge=0, le=500)
    requested_import_mw: float = Field(gt=0, le=1000)
    target_energisation_year: int = Field(default=2028, ge=2026, le=2050)
    redundancy: str = Field(default="single_feed", pattern="^(single_feed|dual_feed|n_minus_one)$")


class ReleaseBNetworkRequest(BaseModel):
    node_id: str = Field(min_length=1, max_length=200)
    voltage_kv: float = Field(ge=0, le=500)
    distance_km: float = Field(default=0, ge=0, le=1000)
    minimum_firm_mw: float = Field(ge=0, le=1000)
    target_energisation_year: int = Field(default=2028, ge=2026, le=2050)
    redundancy: str = Field(default="single_feed", pattern="^(single_feed|dual_feed|n_minus_one)$")


class C1NetworkStudyRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=200)
    model_version: str = Field(min_length=1, max_length=100)
    validation_class: Literal["synthetic_demonstration", "operator_model_unvalidated"]
    buses: list[dict[str, Any]] = Field(min_length=2, max_length=100_000)
    branches: list[dict[str, Any]] = Field(max_length=250_000)
    transformers: list[dict[str, Any]] = Field(max_length=50_000)
    loads: list[dict[str, Any]] = Field(max_length=250_000)
    generators: list[dict[str, Any]] = Field(min_length=1, max_length=250_000)
    switches: list[dict[str, Any]] = Field(default_factory=list, max_length=250_000)
    contingencies: list[dict[str, Any]] = Field(default_factory=list, max_length=10_000)
    connection_bus: str = Field(min_length=1, max_length=200)
    study_year: int = Field(ge=2020, le=2100)
    provenance: dict[str, Any]


class C2HourlyCapacityRequest(C1NetworkStudyRequest):
    requested_import_mw: float = Field(gt=0, le=2_000)
    target_year: int = Field(ge=2026, le=2100)
    hourly_cases: list[dict[str, Any]] = Field(min_length=1, max_length=26_352)


class C3SecurityFlexibilityRequest(BaseModel):
    network_model: dict[str, Any]
    security_criteria: dict[str, Any]
    portfolio: dict[str, Any]
    timestamps: list[str] = Field(min_length=1, max_length=35_040)
    demand_mw: list[float] = Field(min_length=1, max_length=35_040)
    onsite_generation_mw: list[float] = Field(min_length=1, max_length=35_040)
    import_envelope_mw: list[float] = Field(min_length=1, max_length=35_040)
    export_envelope_mw: list[float] = Field(min_length=1, max_length=35_040)
    price_eur_mwh: list[float] = Field(min_length=1, max_length=35_040)
    contract_start: str
    contract_end: str
    fca_mode: Literal["dynamic", "static"] = "dynamic"


class C4ReconciliationRequest(BaseModel):
    observed: list[dict[str, Any]] = Field(min_length=1, max_length=1_000_000)
    simulated: list[dict[str, Any]] = Field(min_length=1, max_length=1_000_000)
    active_power_mae_limit_mw: float = Field(gt=0, le=10_000)
    voltage_mae_limit_pu: float = Field(default=0.02, gt=0, le=0.5)
    minimum_coverage: float = Field(default=0.95, gt=0, le=1)


class P0P4PermutationRequest(C1NetworkStudyRequest):
    scenarios: list[dict[str, Any]] = Field(min_length=1, max_length=100_000)
    candidate_scenarios: list[dict[str, Any]] = Field(default_factory=list, max_length=100_000)
    requested_import_mw: float = Field(gt=0, le=2_000)
    train_surrogate: bool = False
    active_learning_batch_size: int = Field(default=32, ge=1, le=1_000)
    solver_budget: int = Field(default=128, ge=2, le=10_000)


class Release3ShadowValidationRequest(BaseModel):
    network_model: dict[str, Any]
    training_scenarios: list[dict[str, Any]] = Field(min_length=10, max_length=100_000)
    shadow_scenarios: list[dict[str, Any]] = Field(min_length=1, max_length=100_000)
    requested_import_mw: float = Field(gt=0, le=2_000)
    mandatory_contingencies: list[str] = Field(default_factory=list, max_length=10_000)
    operator_reviewed: Literal[False] = False
    operator_training_authorized: Literal[False] = False


class GraphGuidedStudyRequest(BaseModel):
    workspace_id: UUID | None = None
    network_model: dict[str, Any]
    scenarios: list[dict[str, Any]] = Field(min_length=1, max_length=100_000)
    source_bus: str = Field(min_length=1, max_length=200)
    target_buses: list[str] = Field(min_length=1, max_length=10_000)
    mandatory_contingencies: list[str] = Field(default_factory=list, max_length=10_000)
    solver_budget: int = Field(ge=1, le=10_000)
    validation_mode: Literal["qualification", "promoted"] = "qualification"
    reduction_policy: dict[str, Any] | None = None


class UserIdentity(BaseModel):
    id: UUID
    email: str | None = None


class HealthReport(BaseModel):
    status: str
    service: str
    version: str
    job_store: str
