from __future__ import annotations

import threading
import urllib.parse
from datetime import datetime
from typing import Protocol
from uuid import UUID

from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.publish import SupabasePublisher


class JobStore(Protocol):
    def create(self, job: AnalyticsJob) -> AnalyticsJob: ...

    def get(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None: ...

    def update(
        self,
        job_id: UUID,
        *,
        status: JobStatus,
        result_payload: dict | None = None,
        error: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> AnalyticsJob: ...


class InMemoryJobStore:
    """Deterministic development/test store; never used as durable production state."""

    def __init__(self) -> None:
        self._jobs: dict[UUID, AnalyticsJob] = {}
        self._lock = threading.Lock()

    def create(self, job: AnalyticsJob) -> AnalyticsJob:
        with self._lock:
            self._jobs[job.id] = job.model_copy(deep=True)
            return job.model_copy(deep=True)

    def get(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.owner_id != owner_id:
                return None
            return job.model_copy(deep=True)

    def update(
        self,
        job_id: UUID,
        *,
        status: JobStatus,
        result_payload: dict | None = None,
        error: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> AnalyticsJob:
        with self._lock:
            current = self._jobs[job_id]
            updated = current.model_copy(
                update={
                    "status": status,
                    "result_payload": result_payload,
                    "error": error,
                    "started_at": started_at or current.started_at,
                    "completed_at": completed_at or current.completed_at,
                }
            )
            self._jobs[job_id] = updated
            return updated.model_copy(deep=True)


class SupabaseJobStore:
    def __init__(self, url: str, service_role_key: str) -> None:
        self._publisher = SupabasePublisher(url, service_role_key)

    def create(self, job: AnalyticsJob) -> AnalyticsJob:
        rows = self._publisher.request(
            "POST",
            "/analytics_jobs?select=*",
            _job_row(job),
            prefer="return=representation",
        )
        return AnalyticsJob.model_validate(rows[0])

    def get(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None:
        rows = self._publisher.request(
            "GET",
            (
                "/analytics_jobs?select=*&id=eq."
                f"{urllib.parse.quote(str(job_id))}&owner_id=eq.{urllib.parse.quote(str(owner_id))}"
            ),
        )
        return AnalyticsJob.model_validate(rows[0]) if rows else None

    def update(
        self,
        job_id: UUID,
        *,
        status: JobStatus,
        result_payload: dict | None = None,
        error: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> AnalyticsJob:
        payload = {
            "status": status.value,
            "result_payload": result_payload,
            "error": error,
            "started_at": started_at.isoformat() if started_at else None,
            "completed_at": completed_at.isoformat() if completed_at else None,
        }
        rows = self._publisher.request(
            "PATCH",
            f"/analytics_jobs?id=eq.{urllib.parse.quote(str(job_id))}&select=*",
            payload,
            prefer="return=representation",
        )
        if not rows:
            raise KeyError(f"analytics job {job_id} does not exist")
        return AnalyticsJob.model_validate(rows[0])


def _job_row(job: AnalyticsJob) -> dict:
    return {
        "id": str(job.id),
        "owner_id": str(job.owner_id),
        "job_type": job.job_type,
        "status": job.status.value,
        "input_payload": job.input_payload,
        "result_payload": job.result_payload,
        "error": job.error,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }
