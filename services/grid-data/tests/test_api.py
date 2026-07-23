from __future__ import annotations

import unittest
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from grid_data.api.app import create_app
from grid_data.api.models import AnalyticsJob, JobStatus, UserIdentity
from grid_data.api.store import InMemoryJobStore


class SuccessfulExecutor:
    def __init__(self, store: InMemoryJobStore) -> None:
        self.store = store

    def execute_operator_source_health(self, job_id: UUID) -> None:
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={"published": 2, "failed": 1},
        )


class AnalyticsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.owner = UserIdentity(id=uuid4(), email="owner@example.com")
        self.store = InMemoryJobStore()
        self.app = create_app(
            job_store=self.store,
            executor=SuccessfulExecutor(self.store),
            auth_dependency=lambda: self.owner,
        )
        self.client = TestClient(self.app)

    def test_health_does_not_expose_credentials(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["job_store"], "InMemoryJobStore")

    def test_operator_health_job_reuses_job_boundary(self) -> None:
        accepted = self.client.post("/v1/jobs/operator-source-health")
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}")
        self.assertEqual(job.status_code, 200)
        self.assertEqual(job.json()["status"], "succeeded")
        self.assertEqual(job.json()["result_payload"]["published"], 2)

    def test_jobs_are_tenant_isolated(self) -> None:
        other_job = self.store.create(
            AnalyticsJob(owner_id=uuid4(), job_type="operator_source_health")
        )
        response = self.client.get(f"/v1/jobs/{other_job.id}")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
