from uuid import uuid4

import pytest

from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.api.store import InMemoryJobStore
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
