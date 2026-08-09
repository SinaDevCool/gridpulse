from pathlib import Path

from grid_data.p0_foundation import PhysicsOutcome
from grid_data.pilot_acceptance import (
    SYNTHETIC_WATERMARK,
    build_acceptance_report,
    build_public_release4_governance,
    reduction_benchmark,
    replacement_readiness,
)
from grid_data.pilot_providers import SyntheticPilotDataProvider

FIXTURE = Path(__file__).parents[1] / "fixtures" / "synthetic-pilot"


def outcome(identifier: str, capacity: float, feasible: bool = True) -> PhysicsOutcome:
    return PhysicsOutcome(
        identifier,
        identifier * 64,
        capacity,
        5,
        feasible,
        "base",
        "line",
        "test-ac",
        "1",
        "synthetic_demonstration",
        True,
    )


def test_reduction_promotion_requires_worst_case_and_zero_false_safe() -> None:
    full = [outcome("a", 40), outcome("b", 20, False), outcome("c", 30)]
    passing = reduction_benchmark(
        full, full[:2], full_runtime_seconds=10, selected_runtime_seconds=4
    )
    assert passing["accepted_for_reduced_search"] is True
    assert passing["false_safe_rate"] == 0
    failing = reduction_benchmark(
        full, [full[0]], full_runtime_seconds=10, selected_runtime_seconds=2
    )
    assert failing["accepted_for_reduced_search"] is False
    assert failing["missed_infeasible_scenarios"] == ["b"]


def test_synthetic_package_is_replacement_ready_but_never_operator_confirmed(tmp_path) -> None:
    bundle = SyntheticPilotDataProvider(FIXTURE).load()
    readiness = replacement_readiness(bundle)
    assert readiness["synthetic_pilot_complete"] is True
    assert readiness["operator_confirmed"] is False
    report = build_acceptance_report(
        bundle,
        reduction={"accepted_for_reduced_search": True},
        output=tmp_path / "acceptance.json",
    )
    assert report["all_repository_gates_passed"] is True
    assert report["watermark"] == SYNTHETIC_WATERMARK
    assert report["capacity_claim"] is False
    assert report["display_as_capacity"] is False
    public = build_public_release4_governance(report)
    assert public["repository_acceptance"]["passed_gate_count"] == 16
    assert public["graph_and_physics"]["neo4j_provider_contract_exercised"] is True
    assert public["operator_replacement"]["operator_field_count"] == 0
    assert public["private_operator_data_published"] is False
    assert "observations" not in public
