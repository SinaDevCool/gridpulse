from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from grid_data.api.executor import OperatorHealthExecutor
from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.api.store import InMemoryJobStore
from grid_data.api.worker import executor_for, run_once
from grid_data.contracts.pilot_data import ProvenanceRecord


def test_job_claim_is_exclusive_and_checkpoint_is_lease_guarded() -> None:
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=uuid4(), job_type="graph_guided_study"))
    claimed = store.claim("worker-a")
    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.attempt_count == 1
    assert store.claim("worker-b") is None
    checkpointed = store.checkpoint(job.id, "worker-a", {"phase": "topology"})
    assert checkpointed.checkpoint_payload == {"phase": "topology"}
    with pytest.raises(RuntimeError, match="lease"):
        store.checkpoint(job.id, "worker-b", {})


def test_owner_can_cancel_queued_job() -> None:
    owner_id = uuid4()
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=owner_id, job_type="graph_guided_study"))
    cancelled = store.request_cancel(job.id, owner_id)
    assert cancelled is not None
    assert cancelled.status == JobStatus.CANCELLED
    assert cancelled.cancellation_requested is True
    assert cancelled.completed_at is not None
    assert store.claim("worker-a") is None


def test_provenance_exposes_canonical_evidence_origin() -> None:
    provenance = ProvenanceRecord(
        evidence_class="synthetic",
        validation_class="synthetic_demonstration",
        is_synthetic=True,
        source_id="mock:pilot-v1",
        source_url=None,
        source_published_at=None,
        model_version="pilot-v1",
        replacement_contract="replace with operator CGMES",
        license="internal synthetic fixture",
    )
    assert provenance.evidence_origin == "synthetic_fixture"
    assert provenance.network_provenance()["evidence_origin"] == "synthetic_fixture"


def test_all_canonical_job_types_are_dispatchable() -> None:
    store = InMemoryJobStore()
    executor = OperatorHealthExecutor(
        store, supabase_url="https://unused.invalid", service_role_key="unused"
    )
    for job_type in [
        "facility_plan",
        "fca_interval",
        "capacity_requirement",
        "facility_uncertainty",
        "market_qualification",
        "rolling_facility_plan",
        "facility_historical_replay",
        "operator_enquiry_package",
        "shadow_verification",
    ]:
        assert callable(executor_for(job_type, executor))


def test_duplicate_submission_reuses_job_but_cancelled_version_can_be_resubmitted() -> None:
    store = InMemoryJobStore()
    owner = uuid4()
    original = store.create(
        AnalyticsJob(owner_id=owner, job_type="facility_plan", input_fingerprint="a" * 64)
    )
    duplicate = store.create(
        AnalyticsJob(owner_id=owner, job_type="facility_plan", input_fingerprint="a" * 64)
    )
    assert duplicate.id == original.id
    store.request_cancel(original.id, owner)
    replacement = store.create(
        AnalyticsJob(owner_id=owner, job_type="facility_plan", input_fingerprint="a" * 64)
    )
    assert replacement.id != original.id


def test_worker_records_unsupported_type_instead_of_crashing() -> None:
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=uuid4(), job_type="not_supported"))
    executor = OperatorHealthExecutor(
        store, supabase_url="https://unused.invalid", service_role_key="unused"
    )
    assert run_once(store, executor, "worker-a")
    assert store.get_internal(job.id).status == JobStatus.FAILED


def test_cancelled_job_cannot_publish_late_result() -> None:
    store = InMemoryJobStore()
    owner = uuid4()
    job = store.create(AnalyticsJob(owner_id=owner, job_type="facility_plan"))
    claimed = store.claim("worker-a")
    assert claimed is not None
    with store.execution_lease("worker-a", claimed.attempt_count):
        store.request_cancel(job.id, owner)
        with pytest.raises(RuntimeError, match="lease"):
            store.update(job.id, status=JobStatus.SUCCEEDED, result_payload={"unsafe": True})
    assert store.get_internal(job.id).status == JobStatus.CANCELLED


def test_expired_lease_cannot_renew_or_publish_and_retry_is_bounded() -> None:
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=uuid4(), job_type="facility_plan"))
    for attempt in range(1, 4):
        claimed = store.claim(f"worker-{attempt}")
        assert claimed is not None and claimed.attempt_count == attempt
        # Explicit clock fixture, not a wall-clock sleep.
        store._jobs[job.id].lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        with pytest.raises(RuntimeError, match="lease"):
            store.heartbeat(job.id, f"worker-{attempt}")
        with (
            store.execution_lease(f"worker-{attempt}", attempt),
            pytest.raises(RuntimeError, match="lease"),
        ):
            store.update(job.id, status=JobStatus.SUCCEEDED)
    assert store.claim("worker-4") is None
    assert store.get_internal(job.id).status == JobStatus.FAILED
