from __future__ import annotations

import importlib.metadata
from collections.abc import Callable

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status

from grid_data.api.models import (
    HealthReport,
    UserIdentity,
)
from grid_data.api.store import SupabaseJobStore
from grid_data.api.submission import JobSubmission
from grid_data.api.version import SERVICE_VERSION


def build_router(app: FastAPI, auth_dependency: Callable, submission: JobSubmission) -> APIRouter:
    router = APIRouter()

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
            job_store=type(app.state.job_store).__name__,
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
        try:
            engine_version = importlib.metadata.version("gridpulse-capacity-backtest")
            from capacity_backtest.application import contract_manifest

            contract_manifest()
            engine_ready = engine_version.startswith("0.2.")
        except (ImportError, importlib.metadata.PackageNotFoundError):
            engine_ready = False
        durable = isinstance(app.state.job_store, SupabaseJobStore)
        return {
            "durable_store_configured": durable,
            "dispatch_mode": app.state.dispatch_mode,
            "canonical_engine_ready": engine_ready,
            "deployment_ready": durable and engine_ready and app.state.dispatch_mode == "worker",
            "live_facility_connected": False,
            "automatic_dispatch_authorized": False,
            "note": "Configuration check only. Database, worker liveness and facility evidence need separate operational probes.",
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
