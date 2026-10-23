from __future__ import annotations

import json
import logging
import os
import sys
import time
from collections.abc import Callable
from uuid import uuid4

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from grid_data.api.auth import authenticated_user
from grid_data.api.dependencies import ApiDependencies, UnavailableExecutor
from grid_data.api.executor import JobExecutor, OperatorHealthExecutor
from grid_data.api.request_limits import OperationsBodyLimit
from grid_data.api.routers import facility, health, jobs, network
from grid_data.api.store import InMemoryJobStore, JobStore, SupabaseJobStore
from grid_data.api.submission import JobSubmission
from grid_data.api.version import SERVICE_VERSION


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_id", "job_id", "method", "path", "status_code", "elapsed_ms"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(os.environ.get("LOG_LEVEL", "INFO").upper())


def _production_dependencies() -> tuple[JobStore, JobExecutor]:
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        store = InMemoryJobStore()
        return store, UnavailableExecutor()
    store = SupabaseJobStore(supabase_url, service_role_key)
    return (
        store,
        OperatorHealthExecutor(
            store,
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        ),
    )


def create_app(
    *,
    job_store: JobStore | None = None,
    executor: JobExecutor | None = None,
    auth_dependency: Callable = authenticated_user,
    lifespan: Callable | None = None,
    facility_admission: Callable | None = None,
    dispatch_mode: str | None = None,
) -> FastAPI:
    configure_logging()
    if job_store is None or executor is None:
        default_store, default_executor = _production_dependencies()
        job_store = job_store or default_store
        executor = executor or default_executor

    app = FastAPI(
        title="GridPulse Analytics API",
        version=SERVICE_VERSION,
        docs_url="/docs" if os.environ.get("GRIDPULSE_API_DOCS") == "enabled" else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(OperationsBodyLimit)
    allowed_origins = [
        origin.strip()
        for origin in os.environ.get(
            "GRIDPULSE_ALLOWED_ORIGINS",
            "https://gridpulseinsights.com,http://localhost:3002",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["authorization", "content-type", "x-request-id"],
        expose_headers=["x-request-id"],
    )
    app.state.job_store = job_store
    app.state.executor = executor
    app.state.dispatch_mode = dispatch_mode or os.environ.get(
        "GRIDPULSE_JOB_DISPATCH_MODE",
        "worker" if isinstance(job_store, SupabaseJobStore) else "inline",
    )
    if app.state.dispatch_mode not in {"inline", "worker"}:
        raise RuntimeError("GRIDPULSE_JOB_DISPATCH_MODE must be inline or worker")

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid4()))
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logging.getLogger("grid_data.api").exception(
                "request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            raise
        response.headers["x-request-id"] = request_id
        logging.getLogger("grid_data.api").info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        return response

    @app.exception_handler(Exception)
    async def unhandled_error(_request: Request, _error: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal analytics service error"},
        )

    dependencies = ApiDependencies(job_store, executor, app.state.dispatch_mode, facility_admission)
    submission = JobSubmission(dependencies.job_store, dependencies.dispatch_mode)
    for group in (health, jobs, facility, network):
        app.include_router(group.build_router(dependencies, auth_dependency, submission))
    return app


app = create_app()
