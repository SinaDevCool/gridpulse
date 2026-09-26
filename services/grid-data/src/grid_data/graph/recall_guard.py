from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from grid_data.p0_foundation import PhysicsOutcome, canonical_hash


@dataclass(frozen=True)
class RecallPolicy:
    minimum_infeasible_recall: float = 1.0
    minimum_constraint_recall: float = 1.0
    require_all_mandatory: bool = True


def validate_reduction(
    selected: list[PhysicsOutcome],
    full: list[PhysicsOutcome],
    *,
    mandatory_scenario_ids: set[str],
    policy: RecallPolicy | None = None,
) -> dict[str, Any]:
    policy = policy or RecallPolicy()
    selected_ids = {row.scenario_id for row in selected}
    full_ids = {row.scenario_id for row in full}
    if not selected_ids <= full_ids:
        raise ValueError("Selected outcomes are not a subset of the full validation set.")
    full_infeasible = {row.scenario_id for row in full if not row.feasible}
    selected_infeasible = {row.scenario_id for row in selected if not row.feasible}
    full_constraints = {row.binding_constraint for row in full if row.binding_constraint}
    selected_constraints = {row.binding_constraint for row in selected if row.binding_constraint}
    infeasible_recall = (
        1.0
        if not full_infeasible
        else len(full_infeasible & selected_infeasible) / len(full_infeasible)
    )
    false_safe_rate = (
        0.0
        if not full_infeasible
        else len(full_infeasible - selected_infeasible) / len(full_infeasible)
    )
    constraint_recall = (
        1.0
        if not full_constraints
        else len(full_constraints & selected_constraints) / len(full_constraints)
    )
    missing_mandatory = mandatory_scenario_ids - selected_ids
    mandatory_recall = (
        1.0
        if not mandatory_scenario_ids
        else len(mandatory_scenario_ids & selected_ids) / len(mandatory_scenario_ids)
    )
    accepted = (
        infeasible_recall >= policy.minimum_infeasible_recall
        and constraint_recall >= policy.minimum_constraint_recall
        and (not policy.require_all_mandatory or not missing_mandatory)
    )
    payload = {
        "infeasible_recall": round(infeasible_recall, 6),
        "false_safe_rate": round(false_safe_rate, 6),
        "constraint_recall": round(constraint_recall, 6),
        "missed_infeasible_scenarios": sorted(full_infeasible - selected_infeasible),
        "missed_binding_constraints": sorted(full_constraints - selected_constraints),
        "missing_mandatory_scenarios": sorted(missing_mandatory),
        "mandatory_recall": round(mandatory_recall, 6),
        "accepted_for_search_reduction": accepted,
    }
    return {**payload, "validation_sha256": canonical_hash(payload), "capacity_claim": False}
