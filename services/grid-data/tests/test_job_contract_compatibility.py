import json
from pathlib import Path

from grid_data.api.jobs.registry import JOB_TYPES, calculation_for
from grid_data.api.models import AnalyticsJob


def test_shared_browser_fixture_validates_as_python_job():
    fixture = Path(__file__).resolve().parents[3] / "tests/contracts/analytics-job.json"
    job = AnalyticsJob.model_validate(json.loads(fixture.read_text(encoding="utf-8")))
    assert job.status.value == "queued"
    assert job.job_type in JOB_TYPES


def test_each_registered_job_has_a_loadable_calculation():
    for job_type in JOB_TYPES:
        assert callable(calculation_for(job_type))


def test_shared_lifecycle_metadata_variants():
    directory = Path(__file__).resolve().parents[3] / "tests/contracts"
    base = json.loads((directory / "analytics-job.json").read_text(encoding="utf-8"))
    variants = json.loads((directory / "analytics-job-lifecycle.json").read_text(encoding="utf-8"))
    for variant in variants:
        job = AnalyticsJob.model_validate({**base, **variant})
        assert job.status.value == variant["status"]
