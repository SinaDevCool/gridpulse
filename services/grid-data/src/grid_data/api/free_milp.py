"""On-demand, single-worker hosting profile; existing API/store/engine own jobs.

No keepalive, local durable files or alternate queue. Public mode requires
verified visitor sessions, durable admission and a configured submission guard.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import threading
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import Depends, HTTPException
from starlette.responses import JSONResponse

from grid_data.api.app import create_app
from grid_data.api.auth import anonymous_owner, authenticated_user, session_user
from grid_data.api.jobs.context import JobContext
from grid_data.api.jobs.publication import ServiceJobPublisher
from grid_data.api.jobs.runner import JobRunner
from grid_data.api.models import AnalyticsJob, FacilityPlanRequest, UserIdentity
from grid_data.api.request_limits import OperationsBodyLimit
from grid_data.api.store import SupabaseJobStore
from grid_data.api.worker import run_once
from grid_data.publish import PublicationRequestError

LOGGER = logging.getLogger(__name__)
SCOPE = ("facility_plan",)


def validate_free_request(request: FacilityPlanRequest) -> None:
    if len(request.intervals) > 96 or len(request.workloads) > 5 or len(request.batteries) > 1:
        raise HTTPException(422, "Free MILP supports at most 96 intervals, 5 jobs and 1 battery")
    if len(request.profiles) > 5 or any(
        not isinstance(profile.get("points", []), list) or len(profile.get("points", [])) > 6
        for profile in request.profiles
    ):
        raise HTTPException(
            422, "Free MILP supports at most 6 reviewed points per workload profile"
        )
    limit = request.policy.get("solver_time_limit_seconds")
    if isinstance(limit, bool) or not isinstance(limit, (int, float)) or not 0 < limit <= 30:
        raise HTTPException(422, "Set an explicit solver time limit between 0 and 30 seconds")
    if any(interval.get("duration_minutes") not in {15, 30, 60} for interval in request.intervals):
        raise HTTPException(422, "Only 15, 30 and 60 minute intervals are qualified")


class OnDemandWorker:
    def __init__(self, store, executor, owners=frozenset()):
        self.store, self.executor = store, executor
        self.owners = owners
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
                    # Do not claim or exhaust retries for another account's backlog.
                    if getattr(
                        self.store, "access_scope", "private"
                    ) != "public" and self.store.has_foreign_pending(self.owners, "facility_plan"):
                        LOGGER.error("Scoped worker paused: unrelated pending facility jobs")
                        break
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
    def __init__(self, app, wake, public_access=False):
        self.app, self.wake = app, wake
        self.public_access = public_access
        self.submission_lock = asyncio.Lock()

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if self.public_access and path.rstrip("/") == "/v1/jobs":
            await JSONResponse({"detail": "Job listing is unavailable to public visitors"}, 404)(
                scope, receive, send
            )
            return
        if (
            scope["type"] == "http"
            and scope.get("method") == "POST"
            and path != "/v1/jobs/facility-plan"
            and not re.fullmatch(r"/v1/jobs/[a-fA-F0-9-]{36}/cancel", path)
        ):
            await JSONResponse({"detail": "Job type unavailable on the free MILP service"}, 404)(
                scope, receive, send
            )
            return

        async def observe(message):
            if (
                message["type"] == "http.response.start"
                and 200 <= message["status"] < 300
                and path.startswith("/v1/jobs")
            ):
                self.wake()
            await send(message)

        if (
            scope["type"] == "http"
            and scope.get("method") == "POST"
            and path == "/v1/jobs/facility-plan"
        ):
            if self.submission_lock.locked():
                await JSONResponse(
                    {"detail": "Another submission is being admitted; retry shortly"}, 429
                )(scope, receive, send)
                return
            async with self.submission_lock:
                await self.app(scope, receive, observe)
        else:
            await self.app(scope, receive, observe)


def create_free_app(
    *,
    store=None,
    executor=None,
    auth=None,
    enabled=None,
    emails=None,
    owners=None,
    public_access=None,
    submission_guard=None,
):
    public_access = (
        public_access
        if public_access is not None
        else os.environ.get("GRIDPULSE_PUBLIC_MILP_ENABLED") == "true"
    )
    active = enabled if enabled is not None else os.environ.get("GRIDPULSE_MILP_ENABLED") == "true"
    allowed = frozenset(
        email.strip().casefold()
        for email in (
            emails
            if emails is not None
            else os.environ.get("GRIDPULSE_MILP_ALLOWED_EMAILS", "").split(",")
        )
        if email.strip()
    )
    url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    owner_ids = frozenset(
        UUID(str(owner).strip())
        for owner in (
            owners
            if owners is not None
            else os.environ.get("GRIDPULSE_MILP_ALLOWED_OWNER_IDS", "").split(",")
        )
        if str(owner).strip()
    )
    configured = bool(
        (public_access or (allowed and owner_ids))
        and ((url and key and os.environ.get("SUPABASE_PUBLISHABLE_KEY")) or store is not None)
    )
    job_store = store or SupabaseJobStore(
        url, key, access_scope="public" if public_access else "private"
    )
    if public_access and getattr(job_store, "access_scope", None) != "public":
        raise ValueError("Public mode requires a public-scoped durable store")
    stop = threading.Event()

    def execution_policy(job: AnalyticsJob):
        if (
            job.job_type != "facility_plan"
            or (
                public_access
                and (job.access_scope != "public" or not anonymous_owner(job.owner_id))
            )
            or (not public_access and job.owner_id not in owner_ids)
        ):
            raise ValueError("Facility job is outside the approved runtime account scope")
        request = FacilityPlanRequest.model_validate(job.input_payload)
        try:
            validate_free_request(request)
        except HTTPException as error:
            raise ValueError(str(error.detail)) from None

    context = JobContext(
        ServiceJobPublisher(url, key),
        shutdown_requested=stop.is_set,
        wall_clock_limit_seconds=90,
        validate_job=execution_policy,
    )
    runner = executor or JobRunner(job_store, context)
    worker = OnDemandWorker(job_store, runner, owner_ids)

    auth_depends = Depends(auth or (session_user if public_access else authenticated_user))

    def gated_auth(user: UserIdentity = auth_depends):
        if not active or not configured:
            raise HTTPException(503, "Production MILP is disabled or not configured")
        if public_access:
            if not user.is_anonymous or user.token_role != "gridpulse_public_visitor":
                raise HTTPException(403, "A restricted anonymous visitor session is required")
        elif not user.email or user.email.casefold() not in allowed or user.id not in owner_ids:
            raise HTTPException(403, "MILP is not enabled for this account")
        return user

    def admission(request: FacilityPlanRequest, user: UserIdentity, http_request=None):
        validate_free_request(request)
        if public_access:
            if submission_guard is None:
                raise HTTPException(503, "Public submissions await configured bot protection")
            submission_guard(http_request, user)
            return
        # Reuse existing owner-scoped records; do not create another job store.
        if job_store.has_pending(user.id, "facility_plan"):
            raise HTTPException(
                429, "A facility plan is already pending; resume or cancel it first"
            )

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
    app = create_app(
        job_store=job_store,
        executor=runner,
        auth_dependency=gated_auth,
        lifespan=lifespan,
        facility_admission=admission,
        dispatch_mode="worker",
    )
    app.add_middleware(OperationsBodyLimit, maximum_bytes=1_000_000)
    app.add_middleware(OperationsRoutesOnly, wake=worker.wake.set, public_access=public_access)

    @app.exception_handler(PublicationRequestError)
    async def publication_failure(request, error):
        if error.status_code == 429:
            return JSONResponse(
                {"detail": "MILP capacity or quota reached. Retry later."},
                429,
                headers={"Retry-After": "60"},
            )
        return JSONResponse(
            {"detail": "Job storage unavailable; resume by job ID before retrying."}, 503
        )

    @app.get("/healthz")
    def health():
        return {
            "service": "operations-milp",
            "enabled": bool(active and configured),
            "worker_alive": worker.thread.is_alive(),
            "physical_dispatch_authorized": False,
            "hosting": "free_on_demand",
            "maximum_concurrent_solves": 1,
            "public_access": public_access,
            "submissions_enabled": bool(
                active and configured and (not public_access or submission_guard is not None)
            ),
        }

    return app


def app_factory():
    return create_free_app()
