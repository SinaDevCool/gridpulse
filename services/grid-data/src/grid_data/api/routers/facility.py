from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, BackgroundTasks, Depends, status

from grid_data.api.dependencies import ApiDependencies
from grid_data.api.models import (
    CapacityRequirementRequest,
    FacilityHistoricalReplayRequest,
    FacilityPlanRequest,
    FacilityUncertaintyRequest,
    FcaIntervalRequest,
    JobAccepted,
    MarketQualificationRequest,
    RollingFacilityPlanRequest,
    ShadowVerificationRequest,
    UserIdentity,
)
from grid_data.api.replan_policy import ReplanPolicyRequest, assess_replan_policy
from grid_data.api.submission import JobSubmission


def build_router(
    dependencies: ApiDependencies, auth_dependency: Callable, submission: JobSubmission
) -> APIRouter:
    router = APIRouter()
    dispatch = submission.dispatch
    canonical_job = submission.create

    @router.post("/v1/operations/replan-policy")
    def replan_policy(
        request: ReplanPolicyRequest, user: UserIdentity = Depends(auth_dependency)
    ) -> dict[str, object]:
        return assess_replan_policy(request)

    @router.post(
        "/v1/jobs/fca-interval",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_fca_interval_job(
        request: FcaIntervalRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id, job_type="fca_interval", payload=request.model_dump(mode="json")
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("fca_interval"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/facility-plan",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_facility_plan_job(
        request: FacilityPlanRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        if dependencies.facility_admission is not None:
            dependencies.facility_admission(request, user)
        job, created = canonical_job(
            owner_id=user.id,
            job_type="facility_plan",
            payload=request.model_dump(mode="json", exclude_none=True),
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("facility_plan"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/capacity-requirement",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_capacity_requirement_job(
        request: CapacityRequirementRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="capacity_requirement",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("capacity_requirement"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/facility-uncertainty",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_facility_uncertainty_job(
        request: FacilityUncertaintyRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="facility_uncertainty",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("facility_uncertainty"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/market-qualification",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_market_qualification_job(
        request: MarketQualificationRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="market_qualification",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("market_qualification"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/rolling-facility-plan",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_rolling_facility_plan_job(
        request: RollingFacilityPlanRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="rolling_facility_plan",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("rolling_facility_plan"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/facility-historical-replay",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_facility_historical_replay_job(
        request: FacilityHistoricalReplayRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="facility_historical_replay",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(
                background_tasks, dependencies.execution_for("facility_historical_replay"), job.id
            )
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/shadow-verification",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_shadow_verification_job(
        request: ShadowVerificationRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="shadow_verification",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(background_tasks, dependencies.execution_for("shadow_verification"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    return router
