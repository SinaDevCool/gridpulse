"""Production worker: one spawned calculation at a time, fenced by the existing store."""

from __future__ import annotations

import logging
import os
import signal
import socket
import threading
import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

from grid_data.api.app import configure_logging
from grid_data.api.assessment_identity import execution_identity
from grid_data.api.executor import OperatorHealthExecutor
from grid_data.api.jobs.context import JobCancelled, JobLeaseLost
from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.api.process_supervisor import ExecutionLimits, supervise
from grid_data.api.runtime import canonical_engine_ready, validate_runtime
from grid_data.api.store import SupabaseJobStore
from grid_data.api.worker import executor_for

LOGGER = logging.getLogger("grid_data.worker")


def execute_claimed(job_id: str, worker_id: str, attempt: int) -> None:
    # Secrets are inherited through the deployment environment, never CLI arguments.
    store = SupabaseJobStore(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    job = store.get_internal(UUID(job_id))
    if job.lease_owner != worker_id or job.attempt_count != attempt:
        raise JobLeaseLost("Execution attempt replaced")
    if job.execution_manifest:
        _, installed_identity = execution_identity(job.job_type, job.input_payload)
        if installed_identity != job.execution_manifest:
            raise RuntimeError("Worker execution identity differs from submitted assessment")
    with store.execution_lease(worker_id, attempt):
        executor = OperatorHealthExecutor(
            store,
            supabase_url=os.environ["SUPABASE_URL"],
            service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
        executor_for(job.job_type, executor)(job.id)


def run_claimed(
    store: SupabaseJobStore,
    job: AnalyticsJob,
    worker_id: str,
    stop: threading.Event,
    limits: ExecutionLimits,
) -> str:
    last_heartbeat = float("-inf")

    def checkpoint() -> None:
        nonlocal last_heartbeat
        current = store.get_internal(job.id)
        if current.cancellation_requested or current.status == JobStatus.CANCELLED:
            raise JobCancelled("Cancellation requested")
        if current.lease_owner != worker_id or current.attempt_count != job.attempt_count:
            raise JobLeaseLost("Execution attempt replaced")
        if current.status in {JobStatus.SUCCEEDED, JobStatus.FAILED}:
            return
        if current.lease_expires_at is None or current.lease_expires_at <= datetime.now(
            timezone.utc
        ):
            raise JobLeaseLost("Execution lease expired")
        if time.monotonic() - last_heartbeat >= 20:
            store.heartbeat(job.id, worker_id)
            store.worker_heartbeat(worker_id, "busy")
            last_heartbeat = time.monotonic()

    outcome = supervise(
        execute_claimed,
        (str(job.id), worker_id, job.attempt_count),
        limits=limits,
        checkpoint=checkpoint,
        stop=stop,
    )
    current = store.get_internal(job.id)
    if current.status == JobStatus.RUNNING and outcome != "shutdown":
        with store.execution_lease(worker_id, job.attempt_count):
            store.update(
                job.id,
                status=JobStatus.FAILED,
                error=f"Worker calculation {outcome}; restricted diagnostics required.",
                completed_at=datetime.now(timezone.utc),
            )
    # Shutdown deliberately leaves the attempt for bounded expired-lease recovery.
    LOGGER.info("worker attempt finished", extra={"job_id": str(job.id), "outcome": outcome})
    return outcome


def main() -> None:
    validate_runtime(os.environ)
    if not canonical_engine_ready():
        raise RuntimeError("Approved canonical engine is unavailable or incompatible")
    configure_logging()
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    memory_mb = os.environ.get("GRIDPULSE_JOB_MEMORY_MB")
    limits = ExecutionLimits(
        timeout_seconds=float(os.environ.get("GRIDPULSE_JOB_TIMEOUT_SECONDS", "300")),
        memory_limit_mb=int(memory_mb) if memory_mb else None,
    )
    worker_id = f"{socket.gethostname()}-{os.getpid()}-{uuid4().hex[:12]}"
    store = SupabaseJobStore(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    while not stop.is_set():
        try:
            store.worker_heartbeat(worker_id, "idle")
            job = store.claim(worker_id)
            if job is not None:
                run_claimed(store, job, worker_id, stop, limits)
            else:
                stop.wait(5)
        except (JobCancelled, JobLeaseLost):
            LOGGER.warning("worker attempt fenced; no result published")
        except Exception:  # noqa: BLE001 -- supervise failures without logging confidential payloads.
            # No raw exception message: upstream errors may include confidential records.
            LOGGER.error("worker dependency or execution failure")
            stop.wait(5)
    try:
        store.worker_heartbeat(worker_id, "stopping")
    except (RuntimeError, OSError, ValueError):
        LOGGER.warning("worker stopping heartbeat unavailable")


if __name__ == "__main__":
    main()
