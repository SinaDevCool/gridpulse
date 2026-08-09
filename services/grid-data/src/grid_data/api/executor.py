from __future__ import annotations

import logging
import tempfile
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol
from uuid import UUID

from grid_data.api.models import JobStatus
from grid_data.api.store import JobStore
from grid_data.c2_hourly import HourlyOperatingCase, calculate_hourly_envelopes
from grid_data.c3_security_flexibility import run_c3_assessment
from grid_data.c4_operator_pilot import ScadaObservation, reconcile_measurements
from grid_data.flexibility_optimizer import rank_operating_envelopes
from grid_data.graph.pipeline import run_graph_guided_study
from grid_data.graph.publish import publish_graph_study
from grid_data.network_model import screen_reference_topology
from grid_data.network_study import NetworkModelInput, PandapowerProvider
from grid_data.operator_evidence import fetch_operator_sources
from grid_data.operator_health_publish import publish_operator_health
from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition
from grid_data.p0_p4_publish import publish_pipeline_result
from grid_data.p1_permutation import execute_permutations
from grid_data.p2_ensemble import summarize_uncertainty
from grid_data.p3_surrogate import train_surrogates
from grid_data.release2_pipeline import run_release2
from grid_data.release3_pipeline import run_release3
from grid_data.release3_publish import publish_release3
from grid_data.release_b_network import screen_release_b_network
from grid_data.synthetic_capacity import screen_synthetic_capacity

LOGGER = logging.getLogger("grid_data.jobs")


class JobExecutor(Protocol):
    def execute_operator_source_health(self, job_id: UUID) -> None: ...
    def execute_reference_topology(self, job_id: UUID) -> None: ...
    def execute_flexibility_optimization(self, job_id: UUID) -> None: ...
    def execute_synthetic_capacity(self, job_id: UUID) -> None: ...
    def execute_release_b_network(self, job_id: UUID) -> None: ...
    def execute_c1_network_study(self, job_id: UUID) -> None: ...
    def execute_c2_hourly_capacity(self, job_id: UUID) -> None: ...
    def execute_c3_security_flexibility(self, job_id: UUID) -> None: ...
    def execute_c4_reconciliation(self, job_id: UUID) -> None: ...
    def execute_p0_p4_permutation(self, job_id: UUID) -> None: ...
    def execute_release3_shadow_validation(self, job_id: UUID) -> None: ...
    def execute_graph_guided_study(self, job_id: UUID) -> None: ...


class OperatorHealthExecutor:
    """Reuses the CLI connector and publisher behind the durable job boundary."""

    def __init__(
        self,
        store: JobStore,
        *,
        supabase_url: str,
        service_role_key: str,
    ) -> None:
        self._store = store
        self._supabase_url = supabase_url
        self._service_role_key = service_role_key

    def execute_operator_source_health(self, job_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=now)
        LOGGER.info("operator source health job started", extra={"job_id": str(job_id)})
        try:
            with tempfile.TemporaryDirectory(prefix="gridpulse-operator-health-") as directory:
                output = Path(directory) / "operator-evidence.json"
                evidence = fetch_operator_sources(output)
                publication = publish_operator_health(
                    output,
                    supabase_url=self._supabase_url,
                    service_role_key=self._service_role_key,
                )
            result = {
                "source_valid": evidence["valid"],
                "record_count": evidence["record_count"],
                "expected_count": evidence["expected_count"],
                **publication,
            }
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
            LOGGER.info("operator source health job succeeded", extra={"job_id": str(job_id)})
        except Exception as error:
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )
            LOGGER.exception("operator source health job failed", extra={"job_id": str(job_id)})

    def execute_reference_topology(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            result = screen_reference_topology(job.input_payload)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - job boundary records a safe failure
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_flexibility_optimization(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            result = rank_operating_envelopes(job.input_payload)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - job boundary records a safe failure
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_synthetic_capacity(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            result = screen_synthetic_capacity(job.input_payload)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - job boundary records a safe failure
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_release_b_network(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            result = screen_release_b_network(job.input_payload)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - job boundary records a safe failure
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_c1_network_study(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            model = NetworkModelInput(**job.input_payload)
            provider = PandapowerProvider()
            results = [
                asdict(provider.run_base_case(model)),
                asdict(provider.run_voltage_assessment(model)),
                asdict(provider.run_contingency_analysis(model)),
                asdict(provider.calculate_import_capacity(model)),
            ]
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload={
                    "schema_version": "gridpulse-c1-study-v1",
                    "model_id": model.model_id,
                    "model_version": model.model_version,
                    "validation_class": model.validation_class,
                    "results": results,
                },
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - durable job records safe failure
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_c2_hourly_capacity(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            payload = dict(job.input_payload)
            cases = [
                HourlyOperatingCase(
                    **{
                        **item,
                        "timestamp": datetime.fromisoformat(
                            str(item["timestamp"]).replace("Z", "+00:00")
                        ),
                    }
                )
                for item in payload.pop("hourly_cases")
            ]
            requested = float(payload.pop("requested_import_mw"))
            payload.pop("target_year", None)
            model = NetworkModelInput(**payload)
            result = calculate_hourly_envelopes(model, cases, requested_import_mw=requested)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - durable job records safe failure
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_c3_security_flexibility(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            result = run_c3_assessment(job.input_payload)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_c4_reconciliation(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            payload = job.input_payload
            observed = [ScadaObservation(**item) for item in payload["observed"]]
            result = reconcile_measurements(
                observed,
                payload["simulated"],
                active_power_mae_limit_mw=float(payload["active_power_mae_limit_mw"]),
                voltage_mae_limit_pu=float(payload.get("voltage_mae_limit_pu", 0.02)),
                minimum_coverage=float(payload.get("minimum_coverage", 0.95)),
            )
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_p0_p4_permutation(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        release2_artifact_path: Path | None = None
        try:
            payload = dict(job.input_payload)
            scenarios = [ScenarioDefinition(**item) for item in payload.pop("scenarios")]
            candidate_scenarios = [
                ScenarioDefinition(**item) for item in payload.pop("candidate_scenarios", [])
            ]
            requested = float(payload.pop("requested_import_mw"))
            train = bool(payload.pop("train_surrogate", False))
            batch_size = int(payload.pop("active_learning_batch_size", 32))
            solver_budget = int(payload.pop("solver_budget", 128))
            model = NetworkModelInput(**payload)
            provider = PandapowerProvider()
            result = execute_permutations(model, scenarios, provider)
            outcomes = [PhysicsOutcome(**item) for item in result["outcomes"]]
            for outcome in outcomes:
                outcome.features["requested_import_mw"] = requested
            result["ensemble"] = summarize_uncertainty(outcomes, requested_import_mw=requested)
            if train:
                bundle = train_surrogates(outcomes)
                result["surrogate_registry"] = bundle.registry
                if candidate_scenarios:
                    artifact_directory = Path(tempfile.mkdtemp(prefix="gridpulse-release2-"))
                    release2_artifact_path = artifact_directory / f"{job.id}.joblib"

                    def solve_batch(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
                        solved = execute_permutations(model, items, provider)
                        rows = [PhysicsOutcome(**item) for item in solved["outcomes"]]
                        for row in rows:
                            row.features["requested_import_mw"] = requested
                        return rows

                    def solve_one(item: ScenarioDefinition) -> PhysicsOutcome:
                        rows = solve_batch([item])
                        if not rows:
                            raise RuntimeError(
                                "Release 2 physics verification produced no outcome."
                            )
                        return rows[0]

                    mandatory = {
                        str(item["id"])
                        for item in model.contingencies
                        if item.get("mandatory", True)
                    }
                    result["release2"] = run_release2(
                        initial_outcomes=outcomes,
                        candidate_scenarios=candidate_scenarios,
                        requested_import_mw=requested,
                        batch_size=batch_size,
                        mandatory_contingencies=mandatory,
                        solve_batch=solve_batch,
                        solve_one=solve_one,
                        artifact_path=release2_artifact_path,
                        solver_budget=solver_budget,
                    )
            result["public_visibility"] = "private_internal_only"
            result["ledger_publication"] = publish_pipeline_result(
                job=job,
                result=result,
                scenarios=scenarios,
                surrogate_registry=result.get("surrogate_registry"),
                release2=result.get("release2"),
                artifact_path=release2_artifact_path,
                supabase_url=self._supabase_url,
                service_role_key=self._service_role_key,
            )
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=result,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )
        finally:
            if release2_artifact_path:
                release2_artifact_path.unlink(missing_ok=True)
                release2_artifact_path.parent.rmdir()

    def execute_release3_shadow_validation(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            payload = job.input_payload
            model = NetworkModelInput(**payload["network_model"])
            training_scenarios = [
                ScenarioDefinition(**item) for item in payload["training_scenarios"]
            ]
            shadow_scenarios = [ScenarioDefinition(**item) for item in payload["shadow_scenarios"]]
            provider = PandapowerProvider()
            training_result = execute_permutations(model, training_scenarios, provider)
            training_outcomes = [PhysicsOutcome(**item) for item in training_result["outcomes"]]
            requested = float(payload["requested_import_mw"])
            for item in training_outcomes:
                item.features["requested_import_mw"] = requested

            def solve_shadow(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
                result = execute_permutations(model, items, provider)
                return [PhysicsOutcome(**item) for item in result["outcomes"]]

            report = run_release3(
                training_outcomes=training_outcomes,
                shadow_scenarios=shadow_scenarios,
                solve_shadow=solve_shadow,
                requested_import_mw=requested,
                mandatory_contingencies=set(payload.get("mandatory_contingencies", [])),
                operator_reviewed=bool(payload.get("operator_reviewed", False)),
                operator_training_authorized=bool(
                    payload.get("operator_training_authorized", False)
                ),
            )
            report["ledger_publication"] = publish_release3(
                job=job,
                report=report,
                supabase_url=self._supabase_url,
                service_role_key=self._service_role_key,
            )
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=report,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - private job fails closed
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )

    def execute_graph_guided_study(self, job_id: UUID) -> None:
        job = self._store.get_internal(job_id)
        self._store.update(job_id, status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
        try:
            payload = job.input_payload
            report = run_graph_guided_study(
                model=NetworkModelInput(**payload["network_model"]),
                scenarios=[ScenarioDefinition(**row) for row in payload["scenarios"]],
                source_bus=payload["source_bus"],
                target_buses=payload["target_buses"],
                mandatory_contingencies=set(payload.get("mandatory_contingencies", [])),
                budget=int(payload["solver_budget"]),
                validation_mode=str(payload.get("validation_mode", "qualification")),
                reduction_policy=payload.get("reduction_policy"),
            )
            report["ledger_publication"] = publish_graph_study(job=job, report=report)
            self._store.update(
                job_id,
                status=JobStatus.SUCCEEDED,
                result_payload=report,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as error:  # noqa: BLE001 - private job fails closed
            self._store.update(
                job_id,
                status=JobStatus.FAILED,
                error=str(error)[:2000],
                completed_at=datetime.now(timezone.utc),
            )
