from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from uuid import uuid4

import pytest

from grid_data.api.failures import JobCapacityReached, retryable_failure
from grid_data.api.jobs.context import JobContext
from grid_data.api.jobs.runner import JobRunner
from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.api.store import InMemoryJobStore


def test_retry_classification_does_not_retry_invalid_or_denied_inputs():
    assert retryable_failure(TimeoutError())
    assert retryable_failure(URLError("synthetic connection failure"))
    assert retryable_failure(HTTPError("https://test", 503, "unavailable", {}, None))
    assert not retryable_failure(HTTPError("https://test", 403, "denied", {}, None))
    assert not retryable_failure(ValueError("invalid model"))
    assert not retryable_failure(ModuleNotFoundError("private engine unavailable"))


def test_retry_is_deferred_fenced_and_exhausted():
    store = InMemoryJobStore()
    job = store.create(AnalyticsJob(owner_id=uuid4(), job_type="facility_plan"))
    for attempt in range(1, 4):
        claimed = store.claim("worker")
        assert claimed is not None and claimed.attempt_count == attempt
        with store.execution_lease("worker", attempt):
            runner = JobRunner(store, JobContext(publisher=None))
            with patch(
                "grid_data.api.jobs.runner.calculation_for",
                return_value=lambda *_: (_ for _ in ()).throw(TimeoutError()),
            ):
                runner.execute(job.id)
        current = store.get_internal(job.id)
        assert current.result_payload is None
        if attempt < 3:
            assert current.status == JobStatus.QUEUED
            assert store.claim("worker") is None
            store._jobs[job.id].retry_after_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        else:
            assert current.status == JobStatus.FAILED


def test_owner_admission_is_bounded_but_duplicates_are_reused():
    store = InMemoryJobStore()
    owner = uuid4()
    jobs = [
        store.create(
            AnalyticsJob(owner_id=owner, job_type="facility_plan", input_fingerprint=f"{i:064x}")
        )
        for i in range(20)
    ]
    assert (
        store.create(
            AnalyticsJob(owner_id=owner, job_type="facility_plan", input_fingerprint=f"{0:064x}")
        ).id
        == jobs[0].id
    )
    with pytest.raises(JobCapacityReached):
        store.create(AnalyticsJob(owner_id=owner, job_type="facility_plan"))
    store.request_cancel(jobs[0].id, owner)
    assert store.create(AnalyticsJob(owner_id=owner, job_type="facility_plan"))
