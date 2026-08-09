from __future__ import annotations

from dataclasses import asdict
from typing import Any, TypedDict

from grid_data.network_study import NetworkModelInput, PandapowerProvider
from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition, canonical_hash
from grid_data.p1_permutation import execute_permutations

from .contracts import build_projection
from .provider import TopologyProvider, configured_topology_provider
from .recall_guard import RecallPolicy, validate_reduction
from .selection import select_graph_guided_scenarios


class GraphGuidedStudyResult(TypedDict):
    schema_version: str
    projection: dict[str, str]
    audit: dict[str, Any]
    pathways: dict[str, Any]
    selection: dict[str, Any]
    selected_physics_outcomes: list[dict[str, Any]]
    validation_against_full_set: dict[str, Any]
    study_sha256: str
    public_visibility: str
    capacity_claim: bool
    operator_confirmation_created: bool
    topology_provider: str


def run_graph_guided_study(
    *,
    model: NetworkModelInput,
    scenarios: list[ScenarioDefinition],
    source_bus: str,
    target_buses: list[str],
    mandatory_contingencies: set[str],
    budget: int,
    provider: PandapowerProvider | None = None,
    topology_provider: TopologyProvider | None = None,
    validation_mode: str = "qualification",
    reduction_policy: dict[str, Any] | None = None,
) -> GraphGuidedStudyResult:
    if validation_mode not in {"qualification", "promoted"}:
        raise ValueError("validation_mode must be qualification or promoted.")
    if validation_mode == "promoted":
        policy = reduction_policy or {}
        if not (
            policy.get("accepted_for_reduced_search") is True
            and float(policy.get("mandatory_recall", 0)) == 1
            and float(policy.get("false_safe_rate", 1)) == 0
            and policy.get("model_version") == model.model_version
        ):
            raise ValueError("Promoted reduction requires a zero-false-safe policy for this model.")
    projection = build_projection(model)
    topology = topology_provider or configured_topology_provider()
    audit, paths = topology.inspect(projection, source_bus=source_bus, target_buses=target_buses)
    if not audit["accepted_for_physics"]:
        raise ValueError("Topology projection failed the physics-readiness audit.")
    relevant_assets = set(audit["bridge_assets"])
    relevant_assets.update(asset for path in paths["pathways"] for asset in path["asset_ids"])
    # Contingencies reference equipment; convert relevant equipment to their contingency ids.
    relevant_contingencies = {
        str(item["id"])
        for item in model.contingencies
        if str(item.get("element_id")) in relevant_assets
    }
    selection = select_graph_guided_scenarios(
        scenarios=scenarios,
        mandatory_contingencies=mandatory_contingencies,
        relevant_assets=relevant_assets | relevant_contingencies,
        budget=budget,
    )
    selected_ids = set(selection["selected_scenario_ids"])
    selected = [item for item in scenarios if item.scenario_id in selected_ids]
    solver = provider or PandapowerProvider()
    selected_result = execute_permutations(model, selected, solver)
    selected_outcomes = [PhysicsOutcome(**row) for row in selected_result["outcomes"]]
    if validation_mode == "qualification":
        full_result = execute_permutations(model, scenarios, solver)
        full_outcomes = [PhysicsOutcome(**row) for row in full_result["outcomes"]]
        recall = validate_reduction(
            selected_outcomes,
            full_outcomes,
            mandatory_scenario_ids={
                row.scenario_id
                for row in scenarios
                if row.contingency_id in mandatory_contingencies
            },
            policy=RecallPolicy(),
        )
        full_failures = full_result["quarantine"]
    else:
        full_outcomes = []
        full_failures = []
        recall = {
            "accepted_for_search_reduction": True,
            "policy_version": reduction_policy["policy_version"],
            "policy_validation_reused": True,
            "mandatory_recall": reduction_policy["mandatory_recall"],
            "false_safe_rate": reduction_policy["false_safe_rate"],
            "capacity_claim": False,
        }
    validation = {
        "full_case_count": len(full_outcomes),
        "selected_case_count": len(selected_outcomes),
        **recall,
        "selected_solver_failures": selected_result["quarantine"],
        "full_set_solver_failures": full_failures,
        "safe_for_prioritisation": recall["accepted_for_search_reduction"]
        and not selected_result["quarantine"]
        and not full_failures,
        "operator_mandatory_cases_preserved": set(selection["mandatory_included"])
        == mandatory_contingencies,
        "validation_mode": validation_mode,
        "full_physics_executed_this_run": validation_mode == "qualification",
    }
    return {
        "schema_version": "gridpulse-neo4j-guided-study-v1",
        "projection": {
            "model_id": projection.model_id,
            "model_version": projection.model_version,
            "projection_sha256": projection.projection_sha256,
        },
        "audit": audit,
        "pathways": paths,
        "selection": selection,
        "selected_physics_outcomes": [asdict(row) for row in selected_outcomes],
        "validation_against_full_set": validation,
        "study_sha256": canonical_hash(
            {
                "projection": projection.projection_sha256,
                "selection": selection["selection_sha256"],
                "validation": validation,
            }
        ),
        "public_visibility": "private_internal_only",
        "capacity_claim": False,
        "operator_confirmation_created": False,
        "topology_provider": topology.name,
    }
