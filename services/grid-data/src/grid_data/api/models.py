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


class UserIdentity(BaseModel):
    id: UUID
    email: str | None = None


class HealthReport(BaseModel):
    status: str
    service: str
    version: str
    job_store: str
