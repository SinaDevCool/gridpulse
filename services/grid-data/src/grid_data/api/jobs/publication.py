from __future__ import annotations

from pathlib import Path
from typing import Protocol

from grid_data.api.models import AnalyticsJob


class PublicationFailure(RuntimeError):
    pass


class JobPublisher(Protocol):
    def operator_health(self, path: Path) -> dict: ...
    def pipeline(
        self, job: AnalyticsJob, result: dict, scenarios: list, artifact_path: Path | None
    ) -> dict: ...
    def shadow(self, job: AnalyticsJob, report: dict) -> dict: ...


class ServiceJobPublisher:
    """Credentials belong to this infrastructure adapter, not calculation handlers."""

    def __init__(self, url: str, key: str):
        self._url, self._key = url, key

    def operator_health(self, path: Path) -> dict:
        from grid_data.operator_health_publish import publish_operator_health

        try:
            return publish_operator_health(path, supabase_url=self._url, service_role_key=self._key)
        except Exception as error:
            raise PublicationFailure("Operator evidence publication failed") from error

    def pipeline(
        self, job: AnalyticsJob, result: dict, scenarios: list, artifact_path: Path | None
    ) -> dict:
        from grid_data.p0_p4_publish import publish_pipeline_result

        try:
            return publish_pipeline_result(
                job=job,
                result=result,
                scenarios=scenarios,
                surrogate_registry=result.get("surrogate_registry"),
                release2=result.get("release2"),
                artifact_path=artifact_path,
                supabase_url=self._url,
                service_role_key=self._key,
            )
        except Exception as error:
            raise PublicationFailure("Private computation ledger publication failed") from error

    def shadow(self, job: AnalyticsJob, report: dict) -> dict:
        from grid_data.release3_publish import publish_release3

        try:
            return publish_release3(
                job=job, report=report, supabase_url=self._url, service_role_key=self._key
            )
        except Exception as error:
            raise PublicationFailure("Shadow evidence publication failed") from error
