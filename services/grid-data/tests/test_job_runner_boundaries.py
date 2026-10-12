import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from grid_data.api.jobs.context import JobContext, JobLeaseLost
from grid_data.api.jobs.runner import JobRunner
from grid_data.api.models import AnalyticsJob, JobStatus
from grid_data.api.store import InMemoryJobStore


class JobRunnerBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.store = InMemoryJobStore()
        self.job = self.store.create(AnalyticsJob(owner_id=uuid4(), job_type="facility_plan"))
        self.publisher = Mock()
        self.runner = JobRunner(self.store, JobContext(self.publisher))

    def test_success_uses_injected_handler_and_records_result(self):
        with patch(
            "grid_data.api.jobs.runner.calculation_for",
            return_value=lambda context, job: {"ok": True},
        ):
            self.runner.execute(self.job.id)
        self.assertEqual(self.store.get_internal(self.job.id).status, JobStatus.SUCCEEDED)

    def test_cancellation_during_calculation_prevents_success(self):
        def calculate(context, job):
            self.store.request_cancel(job.id, job.owner_id)
            return {"obsolete": True}

        with patch("grid_data.api.jobs.runner.calculation_for", return_value=calculate):
            self.runner.execute(self.job.id)
        current = self.store.get_internal(self.job.id)
        self.assertEqual(current.status, JobStatus.CANCELLED)
        self.assertIsNone(current.result_payload)

    def test_checkpoint_guards_publication_and_handlers_have_no_raw_credentials(self):
        def calculate(context, job):
            self.assertFalse(hasattr(context, "service_role_key"))
            self.store.request_cancel(job.id, job.owner_id)
            context.checkpoint()
            context.publisher.shadow(job, {})
            return {}

        with patch("grid_data.api.jobs.runner.calculation_for", return_value=calculate):
            self.runner.execute(self.job.id)
        self.publisher.shadow.assert_not_called()

    def test_replaced_attempt_cannot_publish_result(self):
        def calculate(context, job):
            self.store._jobs[job.id].attempt_count += 1
            return {"obsolete": True}

        with (
            patch("grid_data.api.jobs.runner.calculation_for", return_value=calculate),
            self.assertRaises(JobLeaseLost),
        ):
            self.runner.execute(self.job.id)
        self.assertIsNone(self.store.get_internal(self.job.id).result_payload)
