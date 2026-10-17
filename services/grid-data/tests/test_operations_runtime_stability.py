import hashlib
import threading
import time
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient

from grid_data.api.app import create_app
from grid_data.api.assessment_identity import execution_identity
from grid_data.api.process_supervisor import ExecutionLimits, supervise
from grid_data.api.runtime import validate_runtime
from grid_data.api.store import InMemoryJobStore, SupabaseJobStore


def finished():
    return


def hanging():
    time.sleep(60)


def crashing():
    raise RuntimeError("synthetic failure")


def test_supervisor_success_crash_timeout_and_shutdown():
    limits = ExecutionLimits(timeout_seconds=15, poll_seconds=0.05, terminate_grace_seconds=1)
    assert (
        supervise(finished, (), limits=limits, checkpoint=lambda: None, stop=threading.Event())
        == "exited"
    )
    assert (
        supervise(crashing, (), limits=limits, checkpoint=lambda: None, stop=threading.Event())
        == "crashed"
    )
    assert (
        supervise(
            hanging,
            (),
            limits=ExecutionLimits(
                timeout_seconds=0.2, poll_seconds=0.05, terminate_grace_seconds=1
            ),
            checkpoint=lambda: None,
            stop=threading.Event(),
        )
        == "timeout"
    )
    stop = threading.Event()
    stop.set()
    assert supervise(hanging, (), limits=limits, checkpoint=lambda: None, stop=stop) == "shutdown"


def test_lost_lease_terminates_child():
    def lost():
        raise RuntimeError("lease lost")

    with pytest.raises(RuntimeError, match="lease lost"):
        supervise(hanging, (), limits=ExecutionLimits(), checkpoint=lost, stop=threading.Event())


def test_deployed_runtime_requires_artifact_and_explicit_configuration(tmp_path):
    with pytest.raises(RuntimeError, match="Missing deployment"):
        validate_runtime({"GRIDPULSE_ENV": "staging"})
    wheel = tmp_path / "approved.whl"
    wheel.write_bytes(b"synthetic configuration test; not an engine")
    env = {
        "GRIDPULSE_ENV": "staging",
        "SUPABASE_URL": "https://staging.example.test",
        "SUPABASE_PUBLISHABLE_KEY": "synthetic",
        "SUPABASE_SERVICE_ROLE_KEY": "synthetic",
        "GRIDPULSE_ALLOWED_ORIGINS": "https://staging-ui.example.test",
        "GRIDPULSE_ENGINE_VERSION": "0.2.0",
        "GRIDPULSE_BUILD_SHA": "a" * 40,
        "GRIDPULSE_ENGINE_SHA256": hashlib.sha256(wheel.read_bytes()).hexdigest(),
        "GRIDPULSE_CANONICAL_WHEEL": str(wheel),
        "GRIDPULSE_JOB_DISPATCH_MODE": "worker",
    }
    validate_runtime(env)
    with pytest.raises(RuntimeError, match="checksum"):
        validate_runtime({**env, "GRIDPULSE_ENGINE_SHA256": "b" * 64})
    with pytest.raises(RuntimeError, match="HTTPS"):
        validate_runtime({**env, "GRIDPULSE_ALLOWED_ORIGINS": "http://localhost:3002"})
    for invalid in (
        "https://ui.example/path",
        "https://ui.example?secret=x",
        "https://ui.example#x",
    ):
        with pytest.raises(RuntimeError, match="HTTPS"):
            validate_runtime({**env, "GRIDPULSE_ALLOWED_ORIGINS": invalid})
    with pytest.raises(RuntimeError, match="worker dispatch"):
        validate_runtime({**env, "GRIDPULSE_JOB_DISPATCH_MODE": "inline"})


def test_identity_replays_and_changes_with_engine_or_inputs(monkeypatch):
    monkeypatch.setenv("GRIDPULSE_BUILD_SHA", "a" * 40)
    with patch("grid_data.api.assessment_identity.metadata.version", return_value="0.2.0"):
        first, manifest = execution_identity("facility_plan", {"b": 2, "a": 1})
        assert execution_identity("facility_plan", {"a": 1, "b": 2})[0] == first
        assert execution_identity("facility_plan", {"a": 2, "b": 2})[0] != first
        assert manifest["service_revision"] == "a" * 40
        with pytest.raises(ValueError):
            execution_identity("facility_plan", {"invalid": float("nan")})
    with patch("grid_data.api.assessment_identity.metadata.version", return_value="0.2.1"):
        assert execution_identity("facility_plan", {"a": 1, "b": 2})[0] != first


def test_liveness_is_not_readiness_or_dispatch_authority():
    client = TestClient(create_app(job_store=InMemoryJobStore(), executor=Mock()))
    assert client.get("/health/live").status_code == 200
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["automatic_dispatch_authorized"] is False
    assert response.json()["worker_available"] is False


def test_database_probe_requires_fresh_revision_matched_worker(monkeypatch):
    monkeypatch.setenv("GRIDPULSE_ENV", "staging")
    monkeypatch.setenv("GRIDPULSE_BUILD_SHA", "a" * 40)
    store = SupabaseJobStore("https://synthetic.invalid", "synthetic")
    store._publisher = Mock()
    store._publisher.request.side_effect = [[], []]
    assert store.operational_probe() == {"database_reachable": True, "worker_available": False}
    query = store._publisher.request.call_args.args[1]
    assert "environment=eq.staging" in query and "observed_at=gte." in query
    assert "revision=eq." + "a" * 40 in query


def test_process_limits_are_bounded():
    with pytest.raises(ValueError):
        ExecutionLimits(timeout_seconds=0)
    with pytest.raises(ValueError):
        ExecutionLimits(memory_limit_mb=1)
