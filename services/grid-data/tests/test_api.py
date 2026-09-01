from __future__ import annotations

import unittest
from dataclasses import asdict
from datetime import datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from grid_data.api.app import create_app
from grid_data.api.models import AnalyticsJob, JobStatus, UserIdentity
from grid_data.api.store import InMemoryJobStore
from grid_data.c2_hourly import HourlyOperatingCase, calculate_hourly_envelopes
from grid_data.network_model import screen_reference_topology
from grid_data.network_study import NetworkModelInput, PandapowerProvider
from grid_data.release_b_network import screen_release_b_network
from grid_data.synthetic_capacity import screen_synthetic_capacity


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

    def execute_facility_plan(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-facility-plan-application-result-v1",
                "input_schema": job.input_payload["schema_version"],
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_fca_interval(self, job_id: UUID) -> None:
        self.store.update(
            job_id, status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-fca-interval-application-result-v1",
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_capacity_requirement(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-capacity-requirement-application-result-v1",
                "input_schema": job.input_payload["schema_version"],
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_facility_uncertainty(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-facility-uncertainty-application-result-v1",
                "input_schema": job.input_payload["schema_version"],
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_market_qualification(self, job_id: UUID) -> None:
        self.store.update(
            job_id, status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-market-qualification-application-result-v1",
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_rolling_facility_plan(self, job_id: UUID) -> None:
        self.store.update(
            job_id, status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-rolling-facility-plan-application-result-v1",
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_facility_historical_replay(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id, status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-facility-historical-replay-application-result-v1",
                "input_schema": job.input_payload["schema_version"],
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_operator_enquiry_package(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id, status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-operator-enquiry-package-application-result-v1",
                "input_schema": job.input_payload["schema_version"],
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_shadow_verification(self, job_id: UUID) -> None:
        self.store.update(
            job_id, status=JobStatus.SUCCEEDED,
            result_payload={
                "schema_version": "gridpulse-shadow-verification-application-result-v1",
                "read_only": True,
                "capacity_claim": False,
                "automatic_live_dispatch_authorized": False,
            },
        )

    def execute_synthetic_capacity(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload=screen_synthetic_capacity(job.input_payload),
        )

    def execute_release_b_network(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload=screen_release_b_network(job.input_payload),
        )

    def execute_c1_network_study(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        model = NetworkModelInput(**job.input_payload)
        result = PandapowerProvider(maximum_capacity_mw=20).calculate_import_capacity(model)
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={"results": [asdict(result)]},
        )

    def execute_c2_hourly_capacity(self, job_id: UUID) -> None:
        job = self.store.get_internal(job_id)
        payload = dict(job.input_payload)
        cases = [
            HourlyOperatingCase(
                **{
                    **case,
                    "timestamp": datetime.fromisoformat(case["timestamp"]),
                }
            )
            for case in payload.pop("hourly_cases")
        ]
        requested = payload.pop("requested_import_mw")
        payload.pop("target_year")
        result = calculate_hourly_envelopes(
            NetworkModelInput(**payload),
            cases,
            requested_import_mw=requested,
            provider=PandapowerProvider(maximum_capacity_mw=20),
        )
        self.store.update(job_id, status=JobStatus.SUCCEEDED, result_payload=result)

    def execute_release3_shadow_validation(self, job_id: UUID) -> None:
        self.store.update(
            job_id,
            status=JobStatus.SUCCEEDED,
            result_payload={"capacity_claim": False, "public_visibility": "private_internal_only"},
        )

    def execute_graph_guided_study(self, job_id: UUID) -> None:
        self.store.update(job_id, status=JobStatus.SUCCEEDED, result_payload={
            "public_visibility": "private_internal_only", "capacity_claim": False,
        })


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
        self.assertEqual(response.json()["grid_core_version"], "0.2.0")
        self.assertIn(
            "gridpulse-facility-plan-request-v1",
            response.json()["canonical_job_schemas"],
        )
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["job_store"], "InMemoryJobStore")

    def test_contract_manifest_exposes_versioned_canonical_jobs(self) -> None:
        response = self.client.get("/v1/contracts")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["schema_version"], "gridpulse-analytics-contract-manifest-v1")
        self.assertEqual(len(payload["fingerprint"]), 64)
        self.assertEqual(
            {item["operation"] for item in payload["contracts"]},
            {
                "capacity_requirement", "facility_plan", "facility_uncertainty",
                "facility_historical_replay", "operator_enquiry_package",
                "shadow_verification",
                "fca_interval",
                "market_qualification",
                "rolling_facility_plan",
            },
        )

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

    def test_job_index_is_tenant_isolated(self) -> None:
        own = self.store.create(AnalyticsJob(owner_id=self.owner.id, job_type="facility_plan"))
        other = self.store.create(AnalyticsJob(owner_id=uuid4(), job_type="facility_plan"))
        response = self.client.get("/v1/jobs")
        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in response.json()}
        self.assertIn(str(own.id), ids)
        self.assertNotIn(str(other.id), ids)

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

    def test_canonical_facility_plan_uses_existing_job_boundary(self) -> None:
        payload = {
                "schema_version": "gridpulse-facility-plan-request-v1",
                "portfolio_id": "portfolio-a",
                "requirement": {"requirement_id": "requirement-a"},
                "intervals": [{"index": 0}],
                "facility": {"facility_id": "facility-a"},
                "workloads": [{"workload_id": "job-a"}],
                "profiles": [{"profile_id": "profile-a"}],
                "policy": {"event_intervals": [True]},
                "economics": {"import_price_eur_per_mwh": [100]},
                "cooling": {"baseline_power_mw": 1},
            }
        accepted = self.client.post("/v1/jobs/facility-plan", json=payload)
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}")
        result = job.json()["result_payload"]
        self.assertEqual(result["input_schema"], "gridpulse-facility-plan-request-v1")
        self.assertFalse(result["capacity_claim"])
        self.assertFalse(result["automatic_live_dispatch_authorized"])
        repeated = self.client.post("/v1/jobs/facility-plan", json=payload)
        self.assertEqual(repeated.status_code, 202)
        self.assertEqual(repeated.json()["job_id"], accepted.json()["job_id"])

    def test_canonical_fca_interval_is_idempotent_and_nonclaiming(self) -> None:
        payload = {
            "schema_version": "gridpulse-fca-interval-request-v1",
            "analysis_kind": "dispatch",
            "points": [{"timestamp": "2026-01-01T00:00:00+00:00", "import_mw": 60, "export_mw": 0}],
            "settings": {
                "firm_import_mw": 50, "conditional_import_mw": 0,
                "minimum_critical_load_mw": 40, "shiftable_load_mw": 5,
                "battery_power_mw": 10, "battery_energy_mwh": 5,
                "battery_round_trip_efficiency": 1, "battery_minimum_soc": 0,
                "initial_battery_soc": 1, "energy_value_eur_mwh": 200,
                "battery_degradation_eur_mwh": 20,
            },
        }
        accepted = self.client.post("/v1/jobs/fca-interval", json=payload)
        self.assertEqual(accepted.status_code, 202)
        repeated = self.client.post("/v1/jobs/fca-interval", json=payload)
        self.assertEqual(repeated.json()["job_id"], accepted.json()["job_id"])
        result = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}").json()["result_payload"]
        self.assertFalse(result["capacity_claim"])
        self.assertFalse(result["automatic_live_dispatch_authorized"])

    def test_canonical_uncertainty_is_idempotent_and_non_operational(self) -> None:
        plan = {
            "schema_version": "gridpulse-facility-plan-request-v1",
            "portfolio_id": "portfolio-a",
            "requirement": {"requirement_id": "requirement-a"},
            "intervals": [{"index": 0}],
            "facility": {"facility_id": "facility-a"},
            "workloads": [{"workload_id": "job-a"}],
            "profiles": [{"profile_id": "profile-a"}],
            "policy": {"event_intervals": [True]},
            "economics": {"import_price_eur_per_mwh": [100]},
            "cooling": {"baseline_power_mw": 1},
        }
        payload = {
            "schema_version": "gridpulse-facility-uncertainty-request-v1",
            "facility_plan": plan,
            "bounds": {
                "temperature_min_c": 20,
                "temperature_max_c": 30,
                "onsite_generation_min_mw": 0,
                "onsite_generation_max_mw": 5,
            },
            "scenario_count": 10,
            "seed": 42,
            "risk_policy": "chance_constrained",
            "confidence": 0.9,
        }
        accepted = self.client.post("/v1/jobs/facility-uncertainty", json=payload)
        self.assertEqual(accepted.status_code, 202)
        repeated = self.client.post("/v1/jobs/facility-uncertainty", json=payload)
        self.assertEqual(repeated.json()["job_id"], accepted.json()["job_id"])
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}").json()
        self.assertFalse(job["result_payload"]["capacity_claim"])
        self.assertFalse(job["result_payload"]["automatic_live_dispatch_authorized"])

    def test_operator_enquiry_package_uses_canonical_durable_job(self) -> None:
        payload = {
            "schema_version": "gridpulse-operator-enquiry-package-request-v1",
            "package_id": "package-a",
            "artifacts": {"capacity_requirement": {"fingerprint": "a" * 64}},
            "blockers": ["operator_confirmation_required"],
            "assumption_ids": ["assumption-a"],
        }
        accepted = self.client.post("/v1/jobs/operator-enquiry-package", json=payload)
        self.assertEqual(accepted.status_code, 202)
        repeated = self.client.post("/v1/jobs/operator-enquiry-package", json=payload)
        self.assertEqual(repeated.json()["job_id"], accepted.json()["job_id"])
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}").json()
        self.assertFalse(job["result_payload"]["capacity_claim"])

    def test_market_and_rolling_jobs_are_idempotent_non_operational_contracts(self) -> None:
        market = {
            "schema_version": "gridpulse-market-qualification-request-v1",
            "product": {"product_id": "p"},
            "requirement": {"requirement_id": "r"},
            "uncertainty": {"fingerprint": "a" * 64},
            "settlement": None,
        }
        accepted = self.client.post("/v1/jobs/market-qualification", json=market)
        self.assertEqual(accepted.status_code, 202)
        repeated = self.client.post("/v1/jobs/market-qualification", json=market)
        self.assertEqual(repeated.json()["job_id"], accepted.json()["job_id"])
        result = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}").json()["result_payload"]
        self.assertFalse(result["capacity_claim"])
        self.assertFalse(result["automatic_live_dispatch_authorized"])

        plan = {
            "schema_version": "gridpulse-facility-plan-request-v1",
            "portfolio_id": "portfolio-a",
            "requirement": {"requirement_id": "requirement-a"},
            "intervals": [{"index": 0}],
            "facility": {"facility_id": "facility-a"},
            "workloads": [{"workload_id": "job-a"}],
            "profiles": [{"profile_id": "profile-a"}],
            "policy": {"event_intervals": [True]},
            "economics": {"import_price_eur_per_mwh": [100]},
            "cooling": {"baseline_power_mw": 1},
        }
        rolling = {
            "schema_version": "gridpulse-rolling-facility-plan-request-v1",
            "facility_plan": plan,
            "windows": [{"window_id": "w1"}],
            "confidence": 0.9,
        }
        accepted = self.client.post("/v1/jobs/rolling-facility-plan", json=rolling)
        self.assertEqual(accepted.status_code, 202)
        result = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}").json()["result_payload"]
        self.assertFalse(result["capacity_claim"])
        self.assertFalse(result["automatic_live_dispatch_authorized"])

    def test_synthetic_capacity_job_preserves_provenance(self) -> None:
        accepted = self.client.post(
            "/v1/jobs/synthetic-capacity",
            json={
                "node_id": "node-110",
                "voltage_kv": 110,
                "requested_import_mw": 80,
                "target_energisation_year": 2028,
                "redundancy": "n_minus_one",
            },
        )
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}")
        result = job.json()["result_payload"]
        self.assertEqual(result["classification"], "synthetic_capacity_scenario")
        self.assertEqual(result["evidence_status"], "synthetic")
        self.assertTrue(result["not_for_connection_decision"])

    def test_release_b_network_job_preserves_security_boundary(self) -> None:
        accepted = self.client.post(
            "/v1/jobs/release-b-network",
            json={
                "node_id": "node-110",
                "voltage_kv": 110,
                "distance_km": 3,
                "minimum_firm_mw": 40,
                "target_energisation_year": 2030,
                "redundancy": "n_minus_one",
            },
        )
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}")
        result = job.json()["result_payload"]
        self.assertEqual(result["validation_status"], "unvalidated_reference_model")
        self.assertTrue(result["not_for_connection_decision"])
        self.assertEqual(len(result["sensitivities"]), 4)

    def test_c1_job_runs_parameterised_ac_capacity_study(self) -> None:
        accepted = self.client.post(
            "/v1/jobs/c1-network-study",
            json={
                "model_id": "api-two-bus",
                "model_version": "v1",
                "validation_class": "synthetic_demonstration",
                "buses": [{"id": "a", "vn_kv": 20}, {"id": "b", "vn_kv": 20}],
                "branches": [
                    {
                        "id": "line",
                        "from_bus": "a",
                        "to_bus": "b",
                        "length_km": 1,
                        "r_ohm_per_km": 0.2,
                        "x_ohm_per_km": 0.1,
                        "c_nf_per_km": 0,
                        "max_i_ka": 0.2,
                    }
                ],
                "transformers": [],
                "loads": [{"id": "load", "bus": "b", "p_mw": 1, "q_mvar": 0.1}],
                "generators": [{"id": "grid", "bus": "a", "kind": "external_grid"}],
                "switches": [],
                "contingencies": [],
                "connection_bus": "b",
                "study_year": 2026,
                "provenance": {
                    "source_url": "https://simbench.de/en/download/",
                    "license": "ODbL-1.0",
                },
            },
        )
        self.assertEqual(accepted.status_code, 202)
        job = self.client.get(f"/v1/jobs/{accepted.json()['job_id']}").json()
        self.assertEqual(job["result_payload"]["results"][0]["study_type"], "capacity")
        self.assertGreater(
            job["result_payload"]["results"][0]["values"]["firm_import_capacity_mw"], 0
        )

    def test_c1_api_cannot_self_promote_to_operator_confirmed(self) -> None:
        response = self.client.post(
            "/v1/jobs/c1-network-study",
            json={
                "model_id": "bad",
                "model_version": "v1",
                "validation_class": "operator_confirmed",
                "buses": [{}, {}],
                "branches": [],
                "transformers": [],
                "loads": [],
                "generators": [{}],
                "connection_bus": "b",
                "study_year": 2026,
                "provenance": {},
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_c2_job_runs_hourly_ac_envelope_without_promoting_validation(self) -> None:
        response = self.client.post(
            "/v1/jobs/c2-hourly-capacity",
            json={
                "model_id": "api-two-bus",
                "model_version": "v1",
                "validation_class": "synthetic_demonstration",
                "buses": [{"id": "a", "vn_kv": 20}, {"id": "b", "vn_kv": 20}],
                "branches": [
                    {
                        "id": "line",
                        "from_bus": "a",
                        "to_bus": "b",
                        "length_km": 1,
                        "r_ohm_per_km": 0.2,
                        "x_ohm_per_km": 0.1,
                        "c_nf_per_km": 0,
                        "max_i_ka": 0.2,
                    }
                ],
                "transformers": [],
                "loads": [{"id": "load", "bus": "b", "p_mw": 1, "q_mvar": 0.1}],
                "generators": [{"id": "grid", "bus": "a", "kind": "external_grid"}],
                "switches": [],
                "contingencies": [],
                "connection_bus": "b",
                "study_year": 2028,
                "target_year": 2028,
                "requested_import_mw": 5,
                "provenance": {
                    "source_url": "https://simbench.de/en/download/",
                    "license": "ODbL-1.0",
                },
                "hourly_cases": [
                    {
                        "timestamp": "2025-01-01T00:00:00+00:00",
                        "weather_year": 2025,
                        "demand_factor": 1,
                        "renewable_factor": 0,
                        "target_year": 2028,
                    }
                ],
            },
        )
        self.assertEqual(response.status_code, 202)
        job = self.client.get(f"/v1/jobs/{response.json()['job_id']}").json()
        self.assertEqual(job["result_payload"]["validation_class"], "synthetic_demonstration")
        self.assertEqual(job["result_payload"]["hour_count"], 1)

    def test_release3_api_is_private_and_cannot_self_attest_operator_review(self) -> None:
        payload = {
            "network_model": {"model_id": "private-model"},
            "training_scenarios": [{"scenario_id": f"train-{i}"} for i in range(10)],
            "shadow_scenarios": [{"scenario_id": "shadow-1"}],
            "requested_import_mw": 20,
        }
        response = self.client.post("/v1/jobs/release3-shadow-validation", json=payload)
        self.assertEqual(response.status_code, 202)
        job = self.client.get(f"/v1/jobs/{response.json()['job_id']}").json()
        self.assertFalse(job["result_payload"]["capacity_claim"])
        rejected = self.client.post(
            "/v1/jobs/release3-shadow-validation",
            json={**payload, "operator_reviewed": True},
        )
        self.assertEqual(rejected.status_code, 422)
        workspace_spoof = self.client.post(
            "/v1/jobs/release3-shadow-validation",
            json={**payload, "workspace_id": "00000000-0000-0000-0000-000000000001"},
        )
        self.assertEqual(workspace_spoof.status_code, 422)

    def test_graph_guided_study_reuses_private_job_boundary(self) -> None:
        response = self.client.post("/v1/jobs/graph-guided-study", json={
            "network_model": {"model_id": "synthetic"},
            "scenarios": [{"scenario_id": "normal"}],
            "source_bus": "a", "target_buses": ["b"],
            "mandatory_contingencies": [], "solver_budget": 1,
        })
        self.assertEqual(response.status_code, 202)
        job = self.client.get(f"/v1/jobs/{response.json()['job_id']}").json()
        self.assertFalse(job["result_payload"]["capacity_claim"])
        spoofed = self.client.post("/v1/jobs/graph-guided-study", json={
            "workspace_id": "00000000-0000-0000-0000-000000000001",
            "network_model": {"model_id": "synthetic"},
            "scenarios": [{"scenario_id": "normal"}],
            "source_bus": "a", "target_buses": ["b"], "solver_budget": 1,
        })
        self.assertEqual(spoofed.status_code, 422)
        promoted = self.client.post("/v1/jobs/graph-guided-study", json={
            "network_model": {"model_id": "synthetic"},
            "scenarios": [{"scenario_id": "normal"}],
            "source_bus": "a", "target_buses": ["b"], "solver_budget": 1,
            "validation_mode": "promoted",
        })
        self.assertEqual(promoted.status_code, 422)


if __name__ == "__main__":
    unittest.main()
