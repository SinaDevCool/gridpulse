"""Compatibility entry point; calculations and lifecycle have separate owners."""

from typing import Protocol
from uuid import UUID

from grid_data.api.jobs.context import JobContext
from grid_data.api.jobs.registry import JOB_TYPES
from grid_data.api.jobs.runner import JobRunner
from grid_data.api.store import JobStore


class JobExecutor(Protocol):
    def execute(self, job_id: UUID) -> None: ...


class OperatorHealthExecutor(JobRunner):
    """Legacy name retained for existing callers; no calculation lives here."""

    def __init__(self, store: JobStore, *, supabase_url: str, service_role_key: str):
        super().__init__(store, JobContext(supabase_url, service_role_key))

    def __getattr__(self, name: str):
        if name.startswith("execute_") and name.removeprefix("execute_") in JOB_TYPES:
            return self.execute
        raise AttributeError(name)
