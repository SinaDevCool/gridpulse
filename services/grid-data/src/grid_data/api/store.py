from __future__ import annotations

import threading
import urllib.parse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID

from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.publish import SupabasePublisher


class JobStore(Protocol):
    def execution_lease(self, worker_id: str, attempt: int): ...
    def create(self, job: AnalyticsJob) -> AnalyticsJob: ...

    def get(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None: ...
    def list_for_owner(self, owner_id: UUID, limit: int = 100) -> list[AnalyticsJob]: ...
    def get_internal(self, job_id: UUID) -> AnalyticsJob: ...
    def find_by_fingerprint(
        self, owner_id: UUID, job_type: str, input_fingerprint: str
    ) -> AnalyticsJob | None: ...

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

    def claim(self, worker_id: str, lease_seconds: int = 120) -> AnalyticsJob | None: ...
    def heartbeat(self, job_id: UUID, worker_id: str, lease_seconds: int = 120) -> AnalyticsJob: ...
    def checkpoint(self, job_id: UUID, worker_id: str, payload: dict) -> AnalyticsJob: ...
    def request_cancel(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None: ...


class InMemoryJobStore:
    """Deterministic development/test store; never used as durable production state."""

    def __init__(self) -> None:
        self._jobs: dict[UUID, AnalyticsJob] = {}
        self._lock = threading.Lock()
        self._execution = threading.local()

    @contextmanager
    def execution_lease(self, worker_id: str, attempt: int):
        self._execution.lease = (worker_id, attempt)
        try:
            yield
        finally:
            self._execution.lease = None

    def create(self, job: AnalyticsJob) -> AnalyticsJob:
        with self._lock:
            if job.input_fingerprint:
                existing = next(
                    (
                        item
                        for item in self._jobs.values()
                        if item.owner_id == job.owner_id
                        and item.job_type == job.job_type
                        and item.input_fingerprint == job.input_fingerprint
                        and item.status not in {JobStatus.FAILED, JobStatus.CANCELLED}
                    ),
                    None,
                )
                if existing is not None:
                    return existing.model_copy(deep=True)
            self._jobs[job.id] = job.model_copy(deep=True)
            return job.model_copy(deep=True)

    def get(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.owner_id != owner_id:
                return None
            return job.model_copy(deep=True)

    def get_internal(self, job_id: UUID) -> AnalyticsJob:
        with self._lock:
            return self._jobs[job_id].model_copy(deep=True)

    def list_for_owner(self, owner_id: UUID, limit: int = 100) -> list[AnalyticsJob]:
        with self._lock:
            jobs = sorted(
                (job for job in self._jobs.values() if job.owner_id == owner_id),
                key=lambda job: job.created_at,
                reverse=True,
            )
            return [job.model_copy(deep=True) for job in jobs[:limit]]

    def find_by_fingerprint(
        self, owner_id: UUID, job_type: str, input_fingerprint: str
    ) -> AnalyticsJob | None:
        with self._lock:
            matches = [
                job
                for job in self._jobs.values()
                if job.owner_id == owner_id
                and job.job_type == job_type
                and job.input_fingerprint == input_fingerprint
                and job.status not in {JobStatus.FAILED, JobStatus.CANCELLED}
            ]
            if not matches:
                return None
            return max(matches, key=lambda job: job.created_at).model_copy(deep=True)

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
            lease = getattr(self._execution, "lease", None)
            if lease and (
                current.lease_owner != lease[0]
                or current.attempt_count != lease[1]
                or current.cancellation_requested
                or current.status != JobStatus.RUNNING
                or current.lease_expires_at is None
                or current.lease_expires_at <= datetime.now(timezone.utc)
            ):
                raise RuntimeError("job execution lease is no longer valid")
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

    def claim(self, worker_id: str, lease_seconds: int = 120) -> AnalyticsJob | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            for current in self._jobs.values():
                if (
                    current.attempt_count >= 3
                    and current.status == JobStatus.RUNNING
                    and current.lease_expires_at
                    and current.lease_expires_at <= now
                ):
                    current.status = JobStatus.FAILED
                    current.error = "Worker lease retry limit exhausted"
                    current.completed_at = now
            eligible = sorted(
                (
                    job
                    for job in self._jobs.values()
                    if not job.cancellation_requested
                    and job.attempt_count < 3
                    and (
                        job.status == JobStatus.QUEUED
                        or (
                            job.status == JobStatus.RUNNING
                            and job.lease_expires_at is not None
                            and job.lease_expires_at <= now
                        )
                    )
                ),
                key=lambda job: job.created_at,
            )
            if not eligible:
                return None
            current = eligible[0]
            updated = current.model_copy(
                update={
                    "status": JobStatus.RUNNING,
                    "started_at": current.started_at or now,
                    "attempt_count": current.attempt_count + 1,
                    "lease_owner": worker_id,
                    "lease_expires_at": now + timedelta(seconds=lease_seconds),
                    "heartbeat_at": now,
                }
            )
            self._jobs[current.id] = updated
            return updated.model_copy(deep=True)

    def heartbeat(self, job_id: UUID, worker_id: str, lease_seconds: int = 120) -> AnalyticsJob:
        now = datetime.now(timezone.utc)
        with self._lock:
            current = self._jobs[job_id]
            if (
                current.lease_owner != worker_id
                or current.status != JobStatus.RUNNING
                or current.lease_expires_at is None
                or current.lease_expires_at <= now
            ):
                raise RuntimeError("job lease is not owned by this worker")
            updated = current.model_copy(
                update={
                    "heartbeat_at": now,
                    "lease_expires_at": now + timedelta(seconds=lease_seconds),
                }
            )
            self._jobs[job_id] = updated
            return updated.model_copy(deep=True)

    def checkpoint(self, job_id: UUID, worker_id: str, payload: dict) -> AnalyticsJob:
        with self._lock:
            current = self._jobs[job_id]
            if current.lease_owner != worker_id or current.status != JobStatus.RUNNING:
                raise RuntimeError("job lease is not owned by this worker")
            updated = current.model_copy(update={"checkpoint_payload": payload})
            self._jobs[job_id] = updated
            return updated.model_copy(deep=True)

    def request_cancel(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            current = self._jobs.get(job_id)
            if current is None or current.owner_id != owner_id:
                return None
            terminal = current.status in {
                JobStatus.SUCCEEDED,
                JobStatus.FAILED,
                JobStatus.CANCELLED,
            }
            updated = current.model_copy(
                update={
                    "cancellation_requested": True,
                    "status": current.status if terminal else JobStatus.CANCELLED,
                    "completed_at": current.completed_at if terminal else now,
                    "lease_owner": None,
                    "lease_expires_at": None,
                }
            )
            self._jobs[job_id] = updated
            return updated.model_copy(deep=True)


class SupabaseJobStore:
    def __init__(self, url: str, service_role_key: str) -> None:
        self._publisher = SupabasePublisher(url, service_role_key)
        self._execution = threading.local()

    @contextmanager
    def execution_lease(self, worker_id: str, attempt: int):
        self._execution.lease = (worker_id, attempt)
        try:
            yield
        finally:
            self._execution.lease = None

    def create(self, job: AnalyticsJob) -> AnalyticsJob:
        rows = self._publisher.request(
            "POST",
            "/rpc/create_analytics_job_once",
            {"p_job": _job_row(job)},
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

    def get_internal(self, job_id: UUID) -> AnalyticsJob:
        rows = self._publisher.request(
            "GET",
            f"/analytics_jobs?select=*&id=eq.{urllib.parse.quote(str(job_id))}",
        )
        if not rows:
            raise KeyError(f"analytics job {job_id} does not exist")
        return AnalyticsJob.model_validate(rows[0])

    def list_for_owner(self, owner_id: UUID, limit: int = 100) -> list[AnalyticsJob]:
        safe_limit = min(max(limit, 1), 200)
        rows = self._publisher.request(
            "GET",
            "/analytics_jobs?select=*&owner_id=eq."
            f"{urllib.parse.quote(str(owner_id))}&order=created_at.desc&limit={safe_limit}",
        )
        return [AnalyticsJob.model_validate(row) for row in rows]

    def find_by_fingerprint(
        self, owner_id: UUID, job_type: str, input_fingerprint: str
    ) -> AnalyticsJob | None:
        rows = self._publisher.request(
            "GET",
            "/analytics_jobs?select=*&owner_id=eq."
            f"{urllib.parse.quote(str(owner_id))}&job_type=eq.{urllib.parse.quote(job_type)}"
            f"&input_fingerprint=eq.{urllib.parse.quote(input_fingerprint)}"
            "&status=not.in.(failed,cancelled)"
            "&order=created_at.desc&limit=1",
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
        lease = getattr(self._execution, "lease", None)
        if lease:
            rows = self._publisher.request(
                "POST",
                "/rpc/update_leased_analytics_job",
                {
                    "p_job_id": str(job_id),
                    "p_worker_id": lease[0],
                    "p_attempt": lease[1],
                    "p_payload": payload,
                },
            )
            if not rows:
                raise RuntimeError("job execution lease is no longer valid")
            return AnalyticsJob.model_validate(rows[0])
        rows = self._publisher.request(
            "PATCH",
            f"/analytics_jobs?id=eq.{urllib.parse.quote(str(job_id))}&select=*",
            payload,
            prefer="return=representation",
        )
        if not rows:
            raise KeyError(f"analytics job {job_id} does not exist")
        return AnalyticsJob.model_validate(rows[0])

    def claim(self, worker_id: str, lease_seconds: int = 120) -> AnalyticsJob | None:
        rows = self._publisher.request(
            "POST",
            "/rpc/claim_analytics_job",
            {
                "p_worker_id": worker_id,
                "p_lease_seconds": lease_seconds,
            },
        )
        return AnalyticsJob.model_validate(rows[0]) if rows else None

    def heartbeat(self, job_id: UUID, worker_id: str, lease_seconds: int = 120) -> AnalyticsJob:
        rows = self._publisher.request(
            "POST",
            "/rpc/heartbeat_analytics_job",
            {
                "p_job_id": str(job_id),
                "p_worker_id": worker_id,
                "p_lease_seconds": lease_seconds,
            },
        )
        if not rows:
            raise RuntimeError("job lease is not owned by this worker")
        return AnalyticsJob.model_validate(rows[0])

    def checkpoint(self, job_id: UUID, worker_id: str, payload: dict) -> AnalyticsJob:
        rows = self._publisher.request(
            "POST",
            "/rpc/checkpoint_analytics_job",
            {
                "p_job_id": str(job_id),
                "p_worker_id": worker_id,
                "p_payload": payload,
            },
        )
        if not rows:
            raise RuntimeError("job lease is not owned by this worker")
        return AnalyticsJob.model_validate(rows[0])

    def request_cancel(self, job_id: UUID, owner_id: UUID) -> AnalyticsJob | None:
        rows = self._publisher.request(
            "POST",
            "/rpc/cancel_analytics_job",
            {
                "p_job_id": str(job_id),
                "p_owner_id": str(owner_id),
            },
        )
        return AnalyticsJob.model_validate(rows[0]) if rows else None


def _job_row(job: AnalyticsJob) -> dict:
    return {
        "id": str(job.id),
        "owner_id": str(job.owner_id),
        "job_type": job.job_type,
        "status": job.status.value,
        "input_payload": job.input_payload,
        "input_fingerprint": job.input_fingerprint,
        "result_payload": job.result_payload,
        "error": job.error,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "attempt_count": job.attempt_count,
        "lease_owner": job.lease_owner,
        "lease_expires_at": job.lease_expires_at.isoformat() if job.lease_expires_at else None,
        "heartbeat_at": job.heartbeat_at.isoformat() if job.heartbeat_at else None,
        "checkpoint_payload": job.checkpoint_payload,
        "cancellation_requested": job.cancellation_requested,
    }
