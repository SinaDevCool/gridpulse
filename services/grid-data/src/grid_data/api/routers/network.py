from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, BackgroundTasks, Depends, status

from grid_data.api.dependencies import ApiDependencies
from grid_data.api.models import (
    AnalyticsJob,
    C1NetworkStudyRequest,
    C2HourlyCapacityRequest,
    C3SecurityFlexibilityRequest,
    C4ReconciliationRequest,
    GraphGuidedStudyRequest,
    JobAccepted,
    OperatorEnquiryPackageRequest,
    P0P4PermutationRequest,
    ReferenceTopologyRequest,
    Release3ShadowValidationRequest,
    ReleaseBNetworkRequest,
    SyntheticCapacityRequest,
    UserIdentity,
)
from grid_data.api.submission import JobSubmission


def build_router(
    dependencies: ApiDependencies, auth_dependency: Callable, submission: JobSubmission
) -> APIRouter:
    router = APIRouter()
    dispatch = submission.dispatch
    canonical_job = submission.create

    @router.post(
        "/v1/jobs/operator-source-health",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_operator_health_job(
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(owner_id=user.id, job_type="operator_source_health")
        )
        dispatch(background_tasks, dependencies.execution_for("operator_source_health"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/reference-topology",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_reference_topology_job(
        request: ReferenceTopologyRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="reference_topology",
                input_payload=request.model_dump(),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("reference_topology"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/operator-enquiry-package",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_operator_enquiry_package_job(
        request: OperatorEnquiryPackageRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job, created = canonical_job(
            owner_id=user.id,
            job_type="operator_enquiry_package",
            payload=request.model_dump(mode="json"),
        )
        if created:
            dispatch(
                background_tasks, dependencies.execution_for("operator_enquiry_package"), job.id
            )
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/synthetic-capacity",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_synthetic_capacity_job(
        request: SyntheticCapacityRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="synthetic_capacity",
                input_payload=request.model_dump(),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("synthetic_capacity"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/release-b-network",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_release_b_network_job(
        request: ReleaseBNetworkRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="release_b_network",
                input_payload=request.model_dump(),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("release_b_network"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/c1-network-study",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_c1_network_study_job(
        request: C1NetworkStudyRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="c1_network_study",
                input_payload=request.model_dump(),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("c1_network_study"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/c2-hourly-capacity",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_c2_hourly_capacity_job(
        request: C2HourlyCapacityRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="c2_hourly_capacity",
                input_payload=request.model_dump(mode="json"),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("c2_hourly_capacity"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/c3-security-flexibility",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_c3_security_flexibility_job(
        request: C3SecurityFlexibilityRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="c3_security_flexibility",
                input_payload=request.model_dump(mode="json"),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("c3_security_flexibility"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/c4-reconciliation",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_c4_reconciliation_job(
        request: C4ReconciliationRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="c4_reconciliation",
                input_payload=request.model_dump(mode="json"),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("c4_reconciliation"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/p0-p4-permutation",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_p0_p4_permutation_job(
        request: P0P4PermutationRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="p0_p4_permutation",
                input_payload=request.model_dump(mode="json"),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("p0_p4_permutation"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/release3-shadow-validation",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_release3_shadow_validation_job(
        request: Release3ShadowValidationRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="release3_shadow_validation",
                input_payload=request.model_dump(mode="json"),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("release3_shadow_validation"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    @router.post(
        "/v1/jobs/graph-guided-study",
        response_model=JobAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def start_graph_guided_study_job(
        request: GraphGuidedStudyRequest,
        background_tasks: BackgroundTasks,
        user: UserIdentity = Depends(auth_dependency),
    ) -> JobAccepted:
        job = dependencies.job_store.create(
            AnalyticsJob(
                owner_id=user.id,
                job_type="graph_guided_study",
                input_payload=request.model_dump(mode="json"),
            )
        )
        dispatch(background_tasks, dependencies.execution_for("graph_guided_study"), job.id)
        return JobAccepted(job_id=job.id, status=job.status)

    return router
