from __future__ import annotations

import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol
from uuid import UUID

from grid_data.api.models import JobStatus
from grid_data.api.store import JobStore
from grid_data.flexibility_optimizer import rank_operating_envelopes
from grid_data.network_model import screen_reference_topology
from grid_data.operator_evidence import fetch_operator_sources
from grid_data.operator_health_publish import publish_operator_health

LOGGER = logging.getLogger("grid_data.jobs")


class JobExecutor(Protocol):
    def execute_operator_source_health(self, job_id: UUID) -> None: ...
    def execute_reference_topology(self, job_id: UUID) -> None: ...
    def execute_flexibility_optimization(self, job_id: UUID) -> None: ...


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
