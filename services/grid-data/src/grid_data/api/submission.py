import hashlib
import json
from collections.abc import Callable
from uuid import UUID

from fastapi import BackgroundTasks

from grid_data.api.models import AnalyticsJob
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
        fingerprint = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        existing = self.store.find_by_fingerprint(owner_id, job_type, fingerprint)
        if existing is not None:
            return existing, False
        proposed = AnalyticsJob(
            owner_id=owner_id,
            job_type=job_type,
            input_payload=payload,
            input_fingerprint=fingerprint,
        )
        created = self.store.create(proposed)
        return created, created.id == proposed.id
