"""Free runtime boundaries, without starting a solver or contacting customer services."""

from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from grid_data.api.free_milp import create_free_app, validate_free_request
from grid_data.api.jobs.context import JobLeaseLost
from grid_data.api.models import AnalyticsJob, JobStatus, UserIdentity
from grid_data.api.store import InMemoryJobStore, SupabaseJobStore
from grid_data.api.worker import run_once


def request(**changes):
    values = dict(
        intervals=[{"duration_minutes": 15}],
        workloads=[{}],
        batteries=[],
        profiles=[{"points": [{}]}],
        policy={"solver_time_limit_seconds": 30},
    )
    return SimpleNamespace(**(values | changes))


@pytest.mark.parametrize(
    "changes",
    [
        {"intervals": [{}] * 97},
        {"workloads": [{}] * 6},
        {"batteries": [{}] * 2},
        {"profiles": [{}] * 6},
        {"profiles": [{"points": None}]},
        {"profiles": [{"points": [{}] * 7}]},
        {"policy": {"solver_time_limit_seconds": 31}},
        {"policy": {"solver_time_limit_seconds": True}},
        {"policy": {"solver_time_limit_seconds": float("nan")}},
        {"intervals": [{"duration_minutes": 1}]},
    ],
)
def test_free_runtime_rejects_unqualified_size_and_budget(changes):
    with pytest.raises(HTTPException) as error:
        validate_free_request(request(**changes))
    assert error.value.status_code == 422


def test_free_runtime_accepts_bounded_request():
    validate_free_request(request())


def test_dispatch_mode_is_explicit_without_global_environment_mutation(monkeypatch):
    monkeypatch.setenv("GRIDPULSE_JOB_DISPATCH_MODE", "inline")
    app = create_free_app(store=InMemoryJobStore(), executor=Mock(), enabled=False)
    assert app.state.dispatch_mode == "worker"
    import os

    assert os.environ["GRIDPULSE_JOB_DISPATCH_MODE"] == "inline"


def test_shutdown_does_not_fail_recoverable_claim():
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=uuid4(), job_type="facility_plan"))
    executor = Mock()
    executor.execute.side_effect = JobLeaseLost("shutdown")
    assert run_once(store, executor, "worker-a", job_types=("facility_plan",))
    current = store.get_internal(job.id)
    assert current.status == JobStatus.RUNNING
    assert current.error is None


def test_pending_probe_is_owner_and_type_scoped():
    owner = uuid4()
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=owner, job_type="facility_plan"))
    assert store.has_pending(owner, "facility_plan")
    assert not store.has_pending(uuid4(), "facility_plan")
    assert not store.has_pending(owner, "rolling_facility_plan")
    store.request_cancel(job.id, owner)
    assert not store.has_pending(owner, "facility_plan")


def test_remote_pending_probe_never_downloads_payloads():
    store = SupabaseJobStore("https://unused.invalid", "unused")
    store._publisher = Mock()
    store._publisher.request.return_value = [{"id": str(uuid4())}]
    assert store.has_pending(uuid4(), "facility_plan")
    method, path = store._publisher.request.call_args.args
    assert method == "GET"
    assert "select=id" in path and "limit=1" in path
    assert "status=in.(queued,running)" in path


@pytest.mark.parametrize(
    "enabled,email,expected",
    [
        (False, "allowed@example.invalid", 503),
        (True, "other@example.invalid", 403),
        (True, "allowed@example.invalid", 200),
    ],
)
def test_account_gate_protects_job_reads(enabled, email, expected):
    owner = uuid4()

    def identity():
        return UserIdentity(id=owner, email=email)

    app = create_free_app(
        store=InMemoryJobStore(),
        executor=Mock(),
        enabled=enabled,
        emails=["allowed@example.invalid"],
        auth=identity,
        owners=[owner],
    )
    with TestClient(app) as client:
        assert client.get("/v1/jobs").status_code == expected
        assert client.post("/v1/jobs/rolling-facility-plan", json={}).status_code == 404
        health = client.get("/healthz").json()
        assert health["physical_dispatch_authorized"] is False
        assert health["maximum_concurrent_solves"] == 1


def test_foreign_pending_jobs_pause_worker_without_claiming():
    from grid_data.api.free_milp import OnDemandWorker

    store = InMemoryJobStore()
    other_job = store.create(AnalyticsJob(owner_id=uuid4(), job_type="facility_plan"))
    executor = Mock()
    worker = OnDemandWorker(store, executor, frozenset({uuid4()}))
    worker.start()
    worker.close()
    assert store.get_internal(other_job.id).status == JobStatus.QUEUED
    executor.execute.assert_not_called()


def test_execution_policy_runs_for_recovered_job_before_calculation(monkeypatch):
    from grid_data.api.jobs.context import JobContext
    from grid_data.api.jobs.runner import JobRunner

    owner = uuid4()
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=owner, job_type="facility_plan"))
    calculation = Mock()
    monkeypatch.setattr("grid_data.api.jobs.runner.calculation_for", lambda kind: calculation)
    policy = Mock(side_effect=ValueError("Request exceeds qualified execution budget"))
    executor = JobRunner(store, JobContext(Mock(), validate_job=policy))
    run_once(store, executor, "recovered-attempt", job_types=("facility_plan",))
    assert store.get_internal(job.id).status == JobStatus.FAILED
    assert "execution budget" in store.get_internal(job.id).error
    policy.assert_called_once()
    calculation.assert_not_called()


def test_foreign_probe_is_bounded_and_read_only():
    store = SupabaseJobStore("https://unused.invalid", "unused")
    store._publisher = Mock()
    store._publisher.request.return_value = []
    assert store.has_foreign_pending(frozenset(), "facility_plan")
    store._publisher.request.assert_not_called()
    assert not store.has_foreign_pending(frozenset({uuid4()}), "facility_plan")
    method, path = store._publisher.request.call_args.args
    assert method == "GET"
    assert "select=id" in path and "limit=1" in path and "owner_id=not.in." in path
