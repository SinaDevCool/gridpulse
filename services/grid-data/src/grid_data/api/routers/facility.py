from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from grid_data.api.dependencies import ApiDependencies
from grid_data.api.models import (
    CapacityRequirementRequest,
    ChronologicalShadowRequest,
    FacilityAccountingRequest,
    FacilityExperimentRequest,
    FacilityHistoricalReplayRequest,
    FacilityPlanRequest,
    FacilityUncertaintyRequest,
    FcaIntervalRequest,
    JobAccepted,
    JobStatus,
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

    @router.post("/v1/jobs/facility-experiment", response_model=JobAccepted, status_code=202)
    def start_facility_experiment(
        request: FacilityExperimentRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        baseline = dependencies.job_store.get(request.baseline_job_id, user.id)
        if baseline is None:
            raise HTTPException(404, "Baseline job not found")
        if (
            baseline.job_type != "facility_plan"
            or baseline.status != JobStatus.SUCCEEDED
            or not baseline.result_payload
        ):
            raise HTTPException(422, "Select a completed facility plan")
        if baseline.result_payload.get("result_fingerprint") != request.baseline_result_fingerprint:
            raise HTTPException(409, "Baseline result changed")
        payload = {
            "schema_version": request.schema_version,
            "facility_plan": baseline.input_payload,
            "baseline": baseline.result_payload,
            "cases": [case.model_dump(mode="json") for case in request.cases],
        }
        job, created = canonical_job(
            owner_id=user.id, job_type="facility_historical_replay", payload=payload
        )
        if created:
            dispatch(
                background_tasks, dependencies.execution_for("facility_historical_replay"), job.id
            )
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post("/v1/jobs/facility-accounting", response_model=JobAccepted, status_code=202)
    def start_facility_accounting(
        request: FacilityAccountingRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        baseline = dependencies.job_store.get(request.baseline_job_id, user.id)
        if baseline is None:
            raise HTTPException(404, "Baseline job not found")
        if (
            baseline.job_type != "facility_plan"
            or baseline.status != JobStatus.SUCCEEDED
            or not baseline.result_payload
        ):
            raise HTTPException(422, "Select a completed facility plan")
        if baseline.result_payload.get("result_fingerprint") != request.baseline_result_fingerprint:
            raise HTTPException(409, "Baseline result changed")
        if len(request.prices_eur_per_mwh) != len(baseline.input_payload.get("intervals", [])):
            raise HTTPException(422, "Provide one price per model interval")
        payload = {
            "schema_version": request.schema_version,
            "facility_plan": baseline.input_payload,
            "baseline": baseline.result_payload,
            "prices_eur_per_mwh": request.prices_eur_per_mwh,
        }
        if request.schema_version.endswith("-v2"):
            payload["tariff"] = request.tariff.model_dump(mode="json")
        job, created = canonical_job(
            owner_id=user.id, job_type="facility_historical_replay", payload=payload
        )
        if created:
            dispatch(
                background_tasks, dependencies.execution_for("facility_historical_replay"), job.id
            )
        return JobAccepted(job_id=job.id, status=job.status)

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
        http_request: Request,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        if dependencies.facility_admission is not None:
            dependencies.facility_admission(request, user, http_request)
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
        request: RollingFacilityPlanRequest | ChronologicalShadowRequest,
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
