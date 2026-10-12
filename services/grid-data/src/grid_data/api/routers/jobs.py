from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status

from grid_data.api.models import (
    AnalyticsJob,
    UserIdentity,
)
from grid_data.api.submission import JobSubmission


def build_router(app: FastAPI, auth_dependency: Callable, submission: JobSubmission) -> APIRouter:
    router = APIRouter()

    @router.get("/v1/jobs", response_model=list[AnalyticsJob])
    def list_jobs(
        limit: int = 100,
        user: UserIdentity = Depends(auth_dependency),
    ) -> list[AnalyticsJob]:
        return app.state.job_store.list_for_owner(user.id, min(max(limit, 1), 200))

    @router.get("/v1/jobs/{job_id}", response_model=AnalyticsJob)
    def get_job(
        job_id: UUID,
        user: UserIdentity = Depends(auth_dependency),
    ) -> AnalyticsJob:
        job = app.state.job_store.get(job_id, user.id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    @router.post("/v1/jobs/{job_id}/cancel", response_model=AnalyticsJob)
    def cancel_job(
        job_id: UUID,
        user: UserIdentity = Depends(auth_dependency),
    ) -> AnalyticsJob:
        job = app.state.job_store.request_cancel(job_id, user.id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    return router
