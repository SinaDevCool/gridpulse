from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


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


class UserIdentity(BaseModel):
    id: UUID
    email: str | None = None


class HealthReport(BaseModel):
    status: str
    service: str
    version: str
    job_store: str
