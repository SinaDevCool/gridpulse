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
from grid_data.api.models import JobStatus
from grid_data.api.store import JobStore, SupabaseJobStore


def executor_for(job_type: str, executor: JobExecutor) -> Callable[[UUID], None]:
    methods = {
        "operator_source_health": executor.execute_operator_source_health,
        "reference_topology": executor.execute_reference_topology,
        "facility_plan": executor.execute_facility_plan,
        "fca_interval": executor.execute_fca_interval,
        "capacity_requirement": executor.execute_capacity_requirement,
        "facility_uncertainty": executor.execute_facility_uncertainty,
        "market_qualification": executor.execute_market_qualification,
        "rolling_facility_plan": executor.execute_rolling_facility_plan,
        "facility_historical_replay": executor.execute_facility_historical_replay,
        "operator_enquiry_package": executor.execute_operator_enquiry_package,
        "shadow_verification": executor.execute_shadow_verification,
        "synthetic_capacity": executor.execute_synthetic_capacity,
        "release_b_network": executor.execute_release_b_network,
        "c1_network_study": executor.execute_c1_network_study,
        "c2_hourly_capacity": executor.execute_c2_hourly_capacity,
        "c3_security_flexibility": executor.execute_c3_security_flexibility,
        "c4_reconciliation": executor.execute_c4_reconciliation,
        "p0_p4_permutation": executor.execute_p0_p4_permutation,
        "release3_shadow_validation": executor.execute_release3_shadow_validation,
        "graph_guided_study": executor.execute_graph_guided_study,
    }
    try:
        return methods[job_type]
    except KeyError as error:
        raise ValueError(f"Unsupported analytics job type: {job_type}") from error


def run_once(store: JobStore, executor: JobExecutor, worker_id: str) -> bool:
    job = store.claim(worker_id)
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
    args = parser.parse_args()
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    worker_id = os.environ.get("GRIDPULSE_WORKER_ID", f"{socket.gethostname()}-{os.getpid()}")
    store = SupabaseJobStore(url, key)
    executor = OperatorHealthExecutor(store, supabase_url=url, service_role_key=key)
    while True:
        worked = run_once(store, executor, worker_id)
        if args.once:
            return
        if not worked:
            time.sleep(max(args.poll_seconds, 0.1))


if __name__ == "__main__":
    main()
