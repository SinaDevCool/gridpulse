from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from grid_data.api.executor import JobExecutor
from grid_data.api.jobs.registry import JOB_TYPES
from grid_data.api.store import JobStore


@dataclass(frozen=True)
class ApiDependencies:
    """Explicit router dependencies; no router reads untyped application state."""

    job_store: JobStore
    executor: JobExecutor
    dispatch_mode: str
    facility_admission: Callable | None = None

    def execution_for(self, job_type: str) -> Callable[[UUID], None]:
        if job_type not in JOB_TYPES:
            raise ValueError(f"Unsupported analytics job type: {job_type}")
        execute = getattr(self.executor, "execute", None)
        if callable(execute):
            return execute
        # Compatibility for existing integration executors during migration.
        legacy = getattr(self.executor, f"execute_{job_type}", None)
        if not callable(legacy):
            raise TypeError(f"job executor is not configured for {job_type}")
        return legacy


class UnavailableExecutor:
    def execute(self, job_id: UUID) -> None:
        raise RuntimeError(f"job executor is not configured for {job_id}")
