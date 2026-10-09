from __future__ import annotations

from importlib.util import find_spec
from uuid import uuid4

from grid_data.api.executor import OperatorHealthExecutor
from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.api.store import InMemoryJobStore


def test_canonical_engine_dependency_is_invoked_or_fails_closed() -> None:
    store = InMemoryJobStore()
    job = store.create(
        AnalyticsJob(
            owner_id=uuid4(),
            job_type="facility_plan",
            input_payload={
                "schema_version": "gridpulse-facility-plan-request-v1",
                "portfolio_id": "integration",
            },
            input_fingerprint="a" * 64,
        )
    )
    executor = OperatorHealthExecutor(
        store,
        supabase_url="https://not-used.invalid",
        service_role_key="not-used",
    )
    executor.execute_facility_plan(job.id)
    completed = store.get_internal(job.id)
    assert completed.status == JobStatus.FAILED
    assert completed.error
    if find_spec("capacity_backtest") is None:
        assert "No module named 'capacity_backtest'" in completed.error
        assert completed.result_payload is None
    else:
        assert "missing required fields" in completed.error
