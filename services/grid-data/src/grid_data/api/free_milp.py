"""On-demand, single-worker hosting profile; existing API/store/engine own jobs.

No keepalive, local durable files, alternate queue or anonymous solve endpoint.
The server is disabled unless explicitly enabled AND an account is allowlisted.
"""
from __future__ import annotations

import logging
import os
import re
import threading
from contextlib import asynccontextmanager

from fastapi import Depends, HTTPException
from starlette.responses import JSONResponse

from grid_data.api.app import create_app
from grid_data.api.auth import authenticated_user
from grid_data.api.jobs.context import JobContext
from grid_data.api.jobs.publication import ServiceJobPublisher
from grid_data.api.jobs.runner import JobRunner
from grid_data.api.models import FacilityPlanRequest, UserIdentity
from grid_data.api.request_limits import OperationsBodyLimit
from grid_data.api.store import SupabaseJobStore
from grid_data.api.worker import run_once

LOGGER = logging.getLogger(__name__)
SCOPE = ("facility_plan",)


def validate_free_request(request: FacilityPlanRequest) -> None:
    if len(request.intervals) > 96 or len(request.workloads) > 5 or len(request.batteries) > 1:
        raise HTTPException(422, "Free MILP supports at most 96 intervals, 5 jobs and 1 battery")
    if len(request.profiles) > 5 or any(
        not isinstance(profile.get("points", []), list)
        or len(profile.get("points", [])) > 6 for profile in request.profiles
    ):
        raise HTTPException(422, "Free MILP supports at most 6 reviewed points per workload profile")
    limit = request.policy.get("solver_time_limit_seconds")
    if isinstance(limit, bool) or not isinstance(limit, (int, float)) or not 0 < limit <= 30:
        raise HTTPException(422, "Set an explicit solver time limit between 0 and 30 seconds")
    if any(interval.get("duration_minutes") not in {15, 30, 60} for interval in request.intervals):
        raise HTTPException(422, "Only 15, 30 and 60 minute intervals are qualified")


class OnDemandWorker:
    def __init__(self, store, executor):
        self.store, self.executor = store, executor
        self.stop = threading.Event()
        self.wake = threading.Event()
        self.thread = threading.Thread(target=self._run, name="operations-milp", daemon=True)
        self.worker_id = "free-milp-" + os.urandom(12).hex()

    def _run(self):
        while not self.stop.is_set():
            self.wake.wait()
            self.wake.clear()
            while not self.stop.is_set():
                try:
                    if not run_once(self.store, self.executor, self.worker_id, job_types=SCOPE):
                        break
                except Exception:
                    LOGGER.exception("Scoped worker unavailable; retry only after new user traffic")
                    break

    def start(self):
        self.thread.start()
        self.wake.set()

    def close(self):
        self.stop.set()
        self.wake.set()
        self.thread.join(timeout=10)


class OperationsRoutesOnly:
    def __init__(self, app, wake):
        self.app, self.wake = app, wake

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] == "http" and scope.get("method") == "POST":
            if path != "/v1/jobs/facility-plan" and not re.fullmatch(r"/v1/jobs/[a-fA-F0-9-]{36}/cancel", path):
                await JSONResponse({"detail": "Job type unavailable on the free MILP service"}, 404)(scope, receive, send)
                return

        async def observe(message):
            if message["type"] == "http.response.start" and 200 <= message["status"] < 300 and path.startswith("/v1/jobs"):
                self.wake()
            await send(message)

        await self.app(scope, receive, observe)


def create_free_app(*, store=None, executor=None, auth=authenticated_user, enabled=None, emails=None):
    active = enabled if enabled is not None else os.environ.get("GRIDPULSE_MILP_ENABLED") == "true"
    allowed = frozenset(email.strip().casefold() for email in (emails if emails is not None else os.environ.get("GRIDPULSE_MILP_ALLOWED_EMAILS", "").split(",")) if email.strip())
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    configured = bool(allowed and ((url and key and os.environ.get("SUPABASE_PUBLISHABLE_KEY")) or store is not None))
    job_store = store or SupabaseJobStore(url, key)
    stop = threading.Event()
    context = JobContext(ServiceJobPublisher(url, key), shutdown_requested=stop.is_set, wall_clock_limit_seconds=90)
    runner = executor or JobRunner(job_store, context)
    worker = OnDemandWorker(job_store, runner)

    def gated_auth(user: UserIdentity = Depends(auth)):
        if not active or not configured:
            raise HTTPException(503, "Production MILP is disabled or not configured")
        if not user.email or user.email.casefold() not in allowed:
            raise HTTPException(403, "MILP is not enabled for this account")
        return user

    def admission(request: FacilityPlanRequest, user: UserIdentity):
        validate_free_request(request)
        # Reuse existing owner-scoped records; do not create another job store.
        if job_store.has_pending(user.id, "facility_plan"):
            raise HTTPException(429, "A facility plan is already pending; resume or cancel it first")

    @asynccontextmanager
    async def lifespan(app):
        if active and configured:
            worker.start()
        try:
            yield
        finally:
            stop.set()
            if worker.thread.is_alive():
                worker.close()

    # No inline calculation fallback: all work is claimed through the scoped RPC.
    app = create_app(job_store=job_store, executor=runner, auth_dependency=gated_auth,
                     lifespan=lifespan, facility_admission=admission, dispatch_mode="worker")
    app.add_middleware(OperationsBodyLimit, maximum_bytes=1_000_000)
    app.add_middleware(OperationsRoutesOnly, wake=worker.wake.set)

    @app.get("/healthz")
    def health():
        return {"service": "operations-milp", "enabled": bool(active and configured),
                "worker_alive": worker.thread.is_alive(), "physical_dispatch_authorized": False,
                "hosting": "free_on_demand", "maximum_concurrent_solves": 1}

    return app


def app_factory():
    return create_free_app()
