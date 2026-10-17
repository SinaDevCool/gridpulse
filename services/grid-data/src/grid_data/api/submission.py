import os
from collections.abc import Callable
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException

from grid_data.api.assessment_identity import execution_identity
from grid_data.api.failures import JobCapacityReached
from grid_data.api.models import AnalyticsJob
from grid_data.api.runtime import canonical_engine_ready
from grid_data.api.store import JobSubmissionStore


class JobSubmission:
    def __init__(self, store: JobSubmissionStore, dispatch_mode: str):
        self.store = store
        self.dispatch_mode = dispatch_mode

    def dispatch(self, background_tasks: BackgroundTasks, method: Callable, job_id: UUID) -> None:
        if self.dispatch_mode == "inline":
            background_tasks.add_task(method, job_id)

    def create(
        self, *, owner_id: UUID, job_type: str, payload: dict[str, object]
    ) -> tuple[AnalyticsJob, bool]:
        if (
            os.environ.get("GRIDPULSE_ENV") in {"staging", "production"}
            and not canonical_engine_ready()
        ):
            raise HTTPException(status_code=503, detail="Approved canonical engine unavailable")
        try:
            fingerprint, manifest = execution_identity(job_type, payload)
        except ValueError as error:
            raise HTTPException(
                status_code=422, detail="Calculation inputs must be finite JSON values"
            ) from error
        existing = self.store.find_by_fingerprint(owner_id, job_type, fingerprint)
        if existing is not None:
            return existing, False
        proposed = AnalyticsJob(
            owner_id=owner_id,
            job_type=job_type,
            input_payload=payload,
            input_fingerprint=fingerprint,
            execution_manifest=manifest,
        )
        try:
            created = self.store.create(proposed)
        except JobCapacityReached as error:
            raise HTTPException(
                status_code=429,
                detail="Active assessment limit reached",
                headers={"Retry-After": "30"},
            ) from error
        return created, created.id == proposed.id
