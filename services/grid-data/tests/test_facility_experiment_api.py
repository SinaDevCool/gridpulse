from uuid import uuid4

from fastapi.testclient import TestClient

from grid_data.api.app import create_app
from grid_data.api.models import AnalyticsJob, JobStatus, UserIdentity
from grid_data.api.store import InMemoryJobStore


class Executor:
    def execute(self, job_id):
        pass


def test_experiment_reuses_owner_scoped_replay_storage_and_rejects_other_owners():
    owner, stranger = uuid4(), uuid4()
    store = InMemoryJobStore()
    baseline = store.create(
        AnalyticsJob(
            owner_id=owner,
            job_type="facility_plan",
            status=JobStatus.SUCCEEDED,
            input_payload={"schema_version": "gridpulse-facility-plan-request-v1"},
            result_payload={"result_fingerprint": "a" * 64},
        )
    )
    user = UserIdentity(id=owner, email="test@example.org")
    app = create_app(job_store=store, executor=Executor(), auth_dependency=lambda: user)
    client = TestClient(app)
    payload = {
        "schema_version": "gridpulse-facility-experiment-request-v1",
        "baseline_job_id": str(baseline.id),
        "baseline_result_fingerprint": "a" * 64,
        "cases": [
            {
                "case_id": "stress",
                "mode": "frozen_plan",
                "changes": [{"field": "import_limit_mw", "value": 90}],
            }
        ],
    }
    response = client.post("/v1/jobs/facility-experiment", json=payload)
    assert response.status_code == 202, response.text
    job_id = response.json()["job_id"]
    from uuid import UUID

    saved = store.get(UUID(job_id), owner)
    assert saved.job_type == "facility_historical_replay"
    assert saved.input_payload["facility_plan"] == baseline.input_payload
    duplicate = client.post("/v1/jobs/facility-experiment", json=payload)
    assert duplicate.json()["job_id"] == job_id
    payload["baseline_result_fingerprint"] = "b" * 64
    assert client.post("/v1/jobs/facility-experiment", json=payload).status_code == 409
    other_app = create_app(
        job_store=store,
        executor=Executor(),
        auth_dependency=lambda: UserIdentity(id=stranger, email="other@example.org"),
    )
    assert (
        TestClient(other_app).post("/v1/jobs/facility-experiment", json=payload).status_code == 404
    )


def test_real_engine_experiment_uses_existing_job_runner(monkeypatch):
    """Run explicitly with GRIDPULSE_EXPERIMENT_FIXTURE; no copied solver fixtures."""
    import json
    import os
    from pathlib import Path
    from uuid import UUID

    import pytest

    fixture = os.environ.get("GRIDPULSE_EXPERIMENT_FIXTURE")
    if not fixture:
        pytest.skip("cross-repository qualification requires an exported engine fixture")
    from grid_data.api.executor import OperatorHealthExecutor

    monkeypatch.setenv("GRIDPULSE_JOB_DISPATCH_MODE", "inline")
    store = InMemoryJobStore()
    owner = UserIdentity(id=uuid4())
    executor = OperatorHealthExecutor(
        store, supabase_url="https://unused.invalid", service_role_key="unused"
    )
    client = TestClient(
        create_app(job_store=store, executor=executor, auth_dependency=lambda: owner)
    )
    payload = json.loads(Path(fixture).read_text(encoding="utf-8"))
    submitted = client.post("/v1/jobs/facility-plan", json=payload)
    assert submitted.status_code == 202, submitted.text
    baseline = store.get(UUID(submitted.json()["job_id"]), owner.id)
    assert baseline.status == JobStatus.SUCCEEDED, baseline.error
    experiment = client.post(
        "/v1/jobs/facility-experiment",
        json={
            "schema_version": "gridpulse-facility-experiment-request-v1",
            "baseline_job_id": str(baseline.id),
            "baseline_result_fingerprint": baseline.result_payload["result_fingerprint"],
            "cases": [
                {
                    "case_id": "lower-limit",
                    "mode": "frozen_plan",
                    "changes": [{"field": "import_limit_mw", "value": 0.001}],
                }
            ],
        },
    )
    assert experiment.status_code == 202, experiment.text
    saved = store.get(UUID(experiment.json()["job_id"]), owner.id)
    assert saved.status == JobStatus.SUCCEEDED, saved.error
    accounted = client.post(
        "/v1/jobs/facility-accounting",
        json={
            "schema_version": "gridpulse-facility-accounting-request-v1",
            "baseline_job_id": str(baseline.id),
            "baseline_result_fingerprint": baseline.result_payload["result_fingerprint"],
            "prices_eur_per_mwh": [100] * len(payload["intervals"]),
        },
    )
    assert accounted.status_code == 202, accounted.text
    accounting = store.get(UUID(accounted.json()["job_id"]), owner.id)
    assert accounting.status == JobStatus.SUCCEEDED, accounting.error
    assert accounting.result_payload["basis"] == "fixed_schedule_energy_only"
    outcome = saved.result_payload["cases"][0]
    assert not outcome["accepted"] and outcome["above_import_limit_minutes"] > 0
    assert (
        saved.result_payload["baseline_result_fingerprint"]
        == baseline.result_payload["result_fingerprint"]
    )


def test_chronological_shadow_is_a_variant_of_existing_rolling_job():
    from uuid import UUID

    from grid_data.api.models import ChronologicalShadowRequest, FacilityPlanRequest

    # Validate transport without pretending that this minimal shell is physical evidence.
    plan = FacilityPlanRequest(
        schema_version="gridpulse-facility-plan-request-v1",
        portfolio_id="test",
        requirement={},
        intervals=[{"start": "2026-01-01T00:00:00Z", "duration_minutes": 15}],
        facility={},
        workloads=[{}],
        profiles=[{}],
        policy={},
        economics={},
        cooling={},
    )
    request = ChronologicalShadowRequest(
        schema_version="gridpulse-chronological-shadow-request-v1",
        facility_plan=plan,
        windows=[{"cutoff": "2026-01-01T00:00:00Z", "available_at": "2026-01-01T00:00:00Z"}],
    )
    store = InMemoryJobStore()
    owner = UserIdentity(id=uuid4())
    client = TestClient(
        create_app(job_store=store, executor=Executor(), auth_dependency=lambda: owner)
    )
    response = client.post("/v1/jobs/rolling-facility-plan", json=request.model_dump(mode="json"))
    assert response.status_code == 202, response.text
    saved = store.get(UUID(response.json()["job_id"]), owner.id)
    assert saved.job_type == "rolling_facility_plan"
    assert saved.input_payload["schema_version"] == request.schema_version


def test_accounting_is_owner_scoped_idempotent_and_requires_aligned_prices():
    from uuid import UUID

    owner, stranger = uuid4(), uuid4()
    store = InMemoryJobStore()
    baseline = store.create(
        AnalyticsJob(
            owner_id=owner,
            job_type="facility_plan",
            status=JobStatus.SUCCEEDED,
            input_payload={"intervals": [{"start": "2026-01-01T00:00:00Z"}]},
            result_payload={"result_fingerprint": "a" * 64},
        )
    )
    client = TestClient(
        create_app(
            job_store=store, executor=Executor(), auth_dependency=lambda: UserIdentity(id=owner)
        )
    )
    payload = {
        "schema_version": "gridpulse-facility-accounting-request-v1",
        "baseline_job_id": str(baseline.id),
        "baseline_result_fingerprint": "a" * 64,
        "prices_eur_per_mwh": [100],
    }
    response = client.post("/v1/jobs/facility-accounting", json=payload)
    assert response.status_code == 202, response.text
    saved = store.get(UUID(response.json()["job_id"]), owner)
    assert saved.input_payload["baseline"] == baseline.result_payload
    assert client.post("/v1/jobs/facility-accounting", json=payload).json()["job_id"] == str(
        saved.id
    )
    assert (
        client.post(
            "/v1/jobs/facility-accounting", json={**payload, "prices_eur_per_mwh": [1, 2]}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/jobs/facility-accounting",
            json={**payload, "baseline_result_fingerprint": "b" * 64},
        ).status_code
        == 409
    )
    other = TestClient(
        create_app(
            job_store=store, executor=Executor(), auth_dependency=lambda: UserIdentity(id=stranger)
        )
    )
    assert other.post("/v1/jobs/facility-accounting", json=payload).status_code == 404
