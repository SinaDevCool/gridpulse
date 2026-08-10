"""P4 active learning and credible rare-event discovery."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass

from .p0_foundation import PhysicsOutcome, ScenarioDefinition


@dataclass(frozen=True)
class CandidatePrediction:
    scenario: ScenarioDefinition
    predicted_capacity_mw: float
    uncertainty_span_mw: float
    out_of_distribution: bool
    violation_probability: float
    model_disagreement: float = 0.0


def acquisition_score(item: CandidatePrediction, *, requested_import_mw: float) -> float:
    boundary = 1 / (1 + abs(item.predicted_capacity_mw - requested_import_mw))
    return round(
        3 * item.violation_probability
        + 2 * item.uncertainty_span_mw
        + 2 * item.model_disagreement
        + 4 * int(item.out_of_distribution)
        + 5 * boundary,
        6,
    )


def select_batch(
    candidates: list[CandidatePrediction],
    *,
    requested_import_mw: float,
    batch_size: int,
    mandatory_contingencies: set[str] | None = None,
) -> list[ScenarioDefinition]:
    mandatory_contingencies = mandatory_contingencies or set()
    available_contingencies = {
        item.scenario.contingency_id
        for item in candidates
        if item.scenario.contingency_id is not None
    }
    missing_mandatory = sorted(mandatory_contingencies - available_contingencies)
    if missing_mandatory:
        raise ValueError(
            "Mandatory contingencies are missing from the candidate pool: "
            + ", ".join(missing_mandatory)
        )
    selected: list[ScenarioDefinition] = []
    selected_hashes: set[str] = set()
    for contingency in sorted(mandatory_contingencies):
        match = next(
            (item.scenario for item in candidates if item.scenario.contingency_id == contingency),
            None,
        )
        if match and match.input_hash not in selected_hashes:
            selected.append(match)
            selected_hashes.add(match.input_hash)
    ranked = sorted(
        candidates,
        key=lambda item: (
            -acquisition_score(item, requested_import_mw=requested_import_mw),
            item.scenario.input_hash,
        ),
    )
    for item in ranked:
        if item.scenario.input_hash not in selected_hashes:
            selected.append(item.scenario)
            selected_hashes.add(item.scenario.input_hash)
        if len(selected) >= batch_size:
            break
    return selected


def rare_event_search(
    seed: ScenarioDefinition,
    solve: Callable[[ScenarioDefinition], PhysicsOutcome],
    *,
    demand_bounds: tuple[float, float] = (0.6, 1.5),
    renewable_bounds: tuple[float, float] = (0, 1.6),
    iterations: int = 16,
) -> dict:
    """Deterministic coordinate search for the lowest credible verified capacity."""
    if (
        iterations < 2
        or demand_bounds[0] > demand_bounds[1]
        or renewable_bounds[0] > renewable_bounds[1]
    ):
        raise ValueError("Rare-event search requires valid bounds and at least two iterations.")
    candidates = []
    for index in range(iterations):
        fraction = index / max(1, iterations - 1)
        demand = demand_bounds[0] + fraction * (demand_bounds[1] - demand_bounds[0])
        renewable = renewable_bounds[1] - fraction * (renewable_bounds[1] - renewable_bounds[0])
        scenario = ScenarioDefinition(
            **{
                **seed.__dict__,
                "scenario_id": f"rare-{seed.scenario_id}-{index}",
                "demand_factor": demand,
                "renewable_factor": renewable,
                "source_kind": "stress",
            }
        )
        outcome = solve(scenario)
        if outcome.physics_verified and outcome.import_capacity_mw is not None:
            candidates.append(outcome)
    worst = min(candidates, key=lambda item: item.import_capacity_mw) if candidates else None
    return {
        "schema_version": "gridpulse-p4-rare-event-v1",
        "physics_solves": iterations,
        "verified_count": len(candidates),
        "worst_outcome": asdict(worst) if worst else None,
        "credible_bounds": {"demand_factor": demand_bounds, "renewable_factor": renewable_bounds},
    }


def promotion_decision(
    *,
    prior_metrics: dict,
    new_metrics: dict,
    false_safe_limit: float,
    minimum_mae_improvement_mw: float = 0,
    physics_coverage: float = 1.0,
    mandatory_contingency_coverage: float = 1.0,
) -> dict:
    false_safe = float(new_metrics.get("false_safe_rate", 1))
    improvement = float(prior_metrics.get("capacity_mae_mw", 0)) - float(
        new_metrics.get("capacity_mae_mw", 0)
    )
    diverse = (
        int(new_metrics.get("unique_capacity_labels", 0)) >= 3
        and float(new_metrics.get("capacity_label_range_mw", 0)) > 0
    )
    complete_physics = physics_coverage == 1.0 and mandatory_contingency_coverage == 1.0
    promote = false_safe <= false_safe_limit and improvement >= minimum_mae_improvement_mw and diverse and complete_physics
    reason = (
        "gates_passed"
        if promote
        else "insufficient_label_diversity"
        if not diverse
        else "incomplete_physics_verification"
        if not complete_physics
        else "safety_or_quality_gate_failed"
    )
    return {
        "decision": "promote" if promote else "reject",
        "rollback_required": not promote,
        "false_safe_rate": false_safe,
        "mae_improvement_mw": round(improvement, 4),
        "physics_coverage": round(physics_coverage, 6),
        "mandatory_contingency_coverage": round(mandatory_contingency_coverage, 6),
        "reason": reason,
    }


def stopping_rule(
    *,
    recent_new_constraints: int,
    percentile_delta_mw: float,
    uncertainty_delta_mw: float,
    solver_budget_used: int,
    solver_budget: int,
) -> dict:
    stopped = solver_budget_used >= solver_budget or (
        recent_new_constraints == 0 and percentile_delta_mw <= 0.5 and uncertainty_delta_mw <= 0.25
    )
    return {
        "stop": stopped,
        "reason": "budget_exhausted"
        if solver_budget_used >= solver_budget
        else "stable_boundary"
        if stopped
        else "continue",
        "solver_budget_remaining": max(0, solver_budget - solver_budget_used),
    }
