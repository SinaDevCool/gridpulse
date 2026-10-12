from importlib import import_module

JOB_TYPES = frozenset(
    [
        "operator_source_health",
        "reference_topology",
        "facility_plan",
        "fca_interval",
        "facility_uncertainty",
        "market_qualification",
        "rolling_facility_plan",
        "facility_historical_replay",
        "operator_enquiry_package",
        "shadow_verification",
        "capacity_requirement",
        "synthetic_capacity",
        "release_b_network",
        "c1_network_study",
        "c2_hourly_capacity",
        "c3_security_flexibility",
        "c4_reconciliation",
        "p0_p4_permutation",
        "release3_shadow_validation",
        "graph_guided_study",
    ]
)


def calculation_for(job_type: str):
    if job_type not in JOB_TYPES:
        raise ValueError(f"Unsupported analytics job type: {job_type}")
    return import_module(f"grid_data.api.jobs.handlers.{job_type}").calculate
