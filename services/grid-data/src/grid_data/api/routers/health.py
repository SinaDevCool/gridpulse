from __future__ import annotations

import importlib.metadata
import logging
import os
from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, status

from grid_data.api.dependencies import ApiDependencies
from grid_data.api.models import (
    HealthReport,
    UserIdentity,
)
from grid_data.api.runtime import canonical_engine_ready
from grid_data.api.store import SupabaseJobStore
from grid_data.api.submission import JobSubmission
from grid_data.api.version import SERVICE_VERSION


def build_router(
    dependencies: ApiDependencies, auth_dependency: Callable, submission: JobSubmission
) -> APIRouter:
    router = APIRouter()

    def readiness() -> dict[str, object]:
        checks = {"database_reachable": False, "worker_available": False}
        if isinstance(dependencies.job_store, SupabaseJobStore):
            try:
                checks = dependencies.job_store.operational_probe()
            except (RuntimeError, OSError, ValueError, KeyError, TypeError):
                logging.getLogger(__name__).warning("Operations readiness dependency probe failed")
        engine_ready = canonical_engine_ready()
        return {
            **checks,
            "canonical_engine_ready": engine_ready,
            "ready": all(checks.values())
            and engine_ready
            and dependencies.dispatch_mode == "worker",
            "live_facility_connected": False,
            "automatic_dispatch_authorized": False,
        }

    @router.get("/health/live")
    def liveness() -> dict[str, str]:
        return {"status": "ok", "revision": os.environ.get("GRIDPULSE_BUILD_SHA", "development")}

    @router.get("/health/ready")
    def ready():
        from fastapi.responses import JSONResponse

        result = readiness()
        return JSONResponse(result, status_code=200 if result["ready"] else 503)

    @router.get("/health", response_model=HealthReport)
    def health() -> HealthReport:
        try:
            engine_version = importlib.metadata.version("gridpulse-capacity-backtest")
        except importlib.metadata.PackageNotFoundError:
            engine_version = None
        return HealthReport(
            status="ok",
            service="gridpulse-analytics",
            version=SERVICE_VERSION,
            job_store=type(dependencies.job_store).__name__,
            grid_core_version=importlib.metadata.version("gridpulse-grid-core"),
            capacity_engine_version=engine_version,
            canonical_job_schemas=[
                "gridpulse-capacity-requirement-request-v1",
                "gridpulse-facility-plan-request-v1",
                "gridpulse-fca-interval-request-v1",
                "gridpulse-market-qualification-request-v1",
                "gridpulse-rolling-facility-plan-request-v1",
                "gridpulse-facility-uncertainty-request-v1",
                "gridpulse-facility-historical-replay-request-v1",
                "gridpulse-operator-enquiry-package-request-v1",
                "gridpulse-shadow-verification-request-v1",
            ],
        )

    @router.get("/v1/operations/readiness")
    def operations_readiness(user: UserIdentity = Depends(auth_dependency)) -> dict[str, object]:
        durable = isinstance(dependencies.job_store, SupabaseJobStore)
        observed = readiness()
        return {
            "durable_store_configured": durable,
            "dispatch_mode": dependencies.dispatch_mode,
            **observed,
            "deployment_ready": observed["ready"],
            "live_facility_connected": False,
            "automatic_dispatch_authorized": False,
            "note": "Operational dependency probes; facility evidence and pilot acceptance remain separate.",
        }

    @router.get("/v1/contracts")
    def contracts() -> dict[str, object]:
        try:
            from capacity_backtest.application import contract_manifest

            return contract_manifest()
        except ImportError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Canonical analytical engine is not installed",
            ) from error

    return router
