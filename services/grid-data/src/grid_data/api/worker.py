"""Lease-based worker for restart-safe GridPulse analytics jobs."""

from __future__ import annotations

import argparse
import os
import socket
import time
from collections.abc import Callable
from uuid import UUID

from grid_data.api.executor import JobExecutor, OperatorHealthExecutor
from grid_data.api.store import SupabaseJobStore


def executor_for(job_type: str, executor: JobExecutor) -> Callable[[UUID], None]:
    methods = {
        "operator_source_health": executor.execute_operator_source_health,
        "reference_topology": executor.execute_reference_topology,
        "flexibility_optimization": executor.execute_flexibility_optimization,
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


def run_once(store: SupabaseJobStore, executor: JobExecutor, worker_id: str) -> bool:
    job = store.claim(worker_id)
    if job is None:
        return False
    store.checkpoint(job.id, worker_id, {"phase": "claimed", "attempt": job.attempt_count})
    executor_for(job.job_type, executor)(job.id)
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
