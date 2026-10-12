import logging
from datetime import datetime, timezone
from uuid import UUID

from grid_data.api.jobs.context import JobContext
from grid_data.api.jobs.registry import calculation_for
from grid_data.api.models import JobStatus
from grid_data.api.store import JobExecutionStore

LOGGER = logging.getLogger("grid_data.jobs")


class JobRunner:
    """One lifecycle owner. The store enforces owner/attempt leases on updates."""

    def __init__(self, store: JobExecutionStore, context: JobContext):
        self._store = store
        self._context = context

    def execute(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        LOGGER.info("analytics job started", extra={"job_id": str(job_id)})
        try:
            result = calculation_for(job.job_type)(self._context, job)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
            LOGGER.info("analytics job result recorded", extra={"job_id": str(job_id)})
        except Exception as error:
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )
            LOGGER.exception("analytics job failed", extra={"job_id": str(job_id)})
