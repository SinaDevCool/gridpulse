from __future__ import annotations

import unittest
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from grid_data.api.app import create_app
from grid_data.api.models import AnalyticsJob, JobStatus, UserIdentity
from grid_data.api.store import InMemoryJobStore
from grid_data.flexibility_optimizer import rank_operating_envelopes
from grid_data.network_model import screen_reference_topology


class SuccessfulExecutor:
    def __init__(self, store: InMemoryJobStore) -> None:
        self.store = store

    def execute_operator_source_health(self, job_id: UUID) -> None:
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={"published": 2, "failed": 1},
        )

    def execute_reference_topology(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload=screen_reference_topology(job.input_payload),
        )

    def execute_flexibility_optimization(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload=rank_operating_envelopes(job.input_payload),
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

    def test_reference_topology_uses_existing_job_boundary(self) -> None:
        accepted = self.client.post(
            "/v1/jobs/reference-topology",
            json={
                "source_node_id": "a",
                "target_node_id": "b",
                "nodes": [
                    {"id": "a", "voltage_kv": 110},
                    {"id": "b", "voltage_kv": 110},
                ],
                "edges": [{"from": "a", "to": "b", "length_km": 3}],
                "lineage": {"source": "test"},
            },
        )
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}")
        self.assertEqual(job.json()["result_payload"]["classification"], "topology_screening_only")

    def test_flexibility_optimizer_uses_existing_job_boundary(self) -> None:
        accepted = self.client.post(
            "/v1/jobs/flexibility-optimization",
            json={
                "demand_mw": [70, 80],
                "minimum_critical_load_mw": 50,
                "candidates": [
                    {"id": "firm-60", "firm_import_mw": 60},
                    {"id": "firm-80", "firm_import_mw": 80},
                ],
            },
        )
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}")
        self.assertEqual(
            job.json()["result_payload"]["classification"],
            "customer_side_candidate_ranking",
        )


if __name__ == "__main__":
    unittest.main()
