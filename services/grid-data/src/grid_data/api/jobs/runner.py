import logging
from dataclasses import replace
from datetime import datetime, timezone
from uuid import UUID

from grid_data.api.jobs.context import JobCancelled, JobContext, JobLeaseLost
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

        def checkpoint() -> None:
            if self._context.shutdown_requested():
                raise JobLeaseLost("Worker is shutting down; leave the lease for recovery")
            current = self._store.get_internal(job_id)
            if current.cancellation_requested or current.status == JobStatus.CANCELLED:
                raise JobCancelled("Cancellation requested")
            if current.attempt_count != job.attempt_count or current.lease_owner != job.lease_owner:
                raise JobLeaseLost("Execution lease replaced")
            if (
                current.lease_expires_at is not None
                and current.lease_expires_at <= self._context.clock()
            ):
                raise JobLeaseLost("Execution lease expired")

        context = replace(self._context, checkpoint=checkpoint)
        checkpoint()
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=context.clock())
        LOGGER.info("analytics job started", extra={"job_id": str(job_id)})
        try:
            context.validate_job(job)
            checkpoint()
            result = calculation_for(job.job_type)(context, job)
            checkpoint()
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=context.clock(),
            )
            LOGGER.info("analytics job result recorded", extra={"job_id": str(job_id)})
        except JobLeaseLost:
            LOGGER.warning(
                "analytics job lease lost; result not recorded", extra={"job_id": str(job_id)}
            )
            raise
        except JobCancelled:
            self._store.update(job_id, status=JobStatus.CANCELLED, completed_at=context.clock())
        except Exception as error:
            checkpoint()
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )
            LOGGER.exception("analytics job failed", extra={"job_id": str(job_id)})
