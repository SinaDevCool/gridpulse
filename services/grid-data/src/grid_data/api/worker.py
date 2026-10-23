"""Lease-based worker for restart-safe GridPulse analytics jobs."""

from __future__ import annotations

import argparse
import logging
import os
import socket
import threading
import time
from collections.abc import Callable
from datetime import datetime, timezone
from uuid import UUID

from grid_data.api.executor import JobExecutor, OperatorHealthExecutor
from grid_data.api.jobs.registry import JOB_TYPES
from grid_data.api.jobs.context import JobLeaseLost
from grid_data.api.models import JobStatus
from grid_data.api.store import JobStore, SupabaseJobStore


def executor_for(job_type: str, executor: JobExecutor) -> Callable[[UUID], None]:
    if job_type not in JOB_TYPES:
        raise ValueError(f"Unsupported analytics job type: {job_type}")
    execute = getattr(executor, "execute", None)
    return execute if callable(execute) else getattr(executor, f"execute_{job_type}")


def run_once(
    store: JobStore,
    executor: JobExecutor,
    worker_id: str,
    *,
    job_types: tuple[str, ...] | None = None,
) -> bool:
    # Never fall back to an unscoped claim if a scoped RPC is unavailable.
    job = (
        store.claim(worker_id) if job_types is None else store.claim(worker_id, job_types=job_types)
    )
    if job is None:
        return False
    stop = threading.Event()

    def renew() -> None:
        while not stop.wait(30):
            try:
                store.heartbeat(job.id, worker_id)
            except Exception:
                logging.getLogger(__name__).exception(
                    "job heartbeat failed", extra={"job_id": str(job.id)}
                )
                return

    heartbeat = threading.Thread(target=renew, daemon=True)
    heartbeat.start()
    try:
        with store.execution_lease(worker_id, job.attempt_count):
            store.checkpoint(job.id, worker_id, {"phase": "claimed", "attempt": job.attempt_count})
            try:
                executor_for(job.job_type, executor)(job.id)
            except JobLeaseLost:
                logging.getLogger(__name__).info(
                    "Execution stopped without publication; lease remains recoverable",
                    extra={"job_id": str(job.id)},
                )
            except Exception:
                logging.getLogger(__name__).exception(
                    "job execution failed", extra={"job_id": str(job.id)}
                )
                current = store.get_internal(job.id)
                if (
                    current.status == JobStatus.RUNNING
                    and current.lease_owner == worker_id
                    and current.attempt_count == job.attempt_count
                ):
                    store.update(
                        job.id,
                        status=JobStatus.FAILED,
                        error="Worker execution failed; see restricted service logs.",
                        completed_at=datetime.now(timezone.utc),
                    )
    except Exception:
        logging.getLogger(__name__).exception(
            "job lease or persistence lost", extra={"job_id": str(job.id)}
        )
    finally:
        stop.set()
        heartbeat.join(timeout=2)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the durable GridPulse analytics worker")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    parser.add_argument("--job-type", action="append", choices=sorted(JOB_TYPES))
    args = parser.parse_args()
    job_types = tuple(args.job_type) if args.job_type else None
    if job_types is not None and len(job_types) > 20:
        parser.error("At most 20 job types may be selected")
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    worker_id = os.environ.get("GRIDPULSE_WORKER_ID", f"{socket.gethostname()}-{os.getpid()}")
    store = SupabaseJobStore(url, key)
    executor = OperatorHealthExecutor(store, supabase_url=url, service_role_key=key)
    while True:
        worked = run_once(store, executor, worker_id, job_types=job_types)
        if args.once:
            return
        if not worked:
            time.sleep(max(args.poll_seconds, 0.1))


if __name__ == "__main__":
    main()
