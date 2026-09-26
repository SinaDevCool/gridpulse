"""Release 2 orchestration: AI prioritises cases; verified physics remains authoritative."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict
from pathlib import Path

from .p0_foundation import PhysicsOutcome, ScenarioDefinition, canonical_hash
from .p3_surrogate import predict, serialize_bundle, train_surrogates
from .p4_active_learning import (
    CandidatePrediction,
    promotion_decision,
    rare_event_search,
    select_batch,
    stopping_rule,
)


def _scenario_features(
    scenario: ScenarioDefinition, requested_import_mw: float
) -> dict[str, float]:
    return {
        "demand_factor": scenario.demand_factor,
        "renewable_factor": scenario.renewable_factor,
        "accepted_connections_mw": scenario.accepted_connections_mw,
        "reinforcement_delay_years": float(scenario.reinforcement_delay_years),
        "battery_availability": scenario.battery_availability,
        "flexible_load_availability": scenario.flexible_load_availability,
        "battery_dispatch_mw": scenario.battery_dispatch_mw,
        "flexible_load_reduction_mw": scenario.flexible_load_reduction_mw,
        "contingency_present": float(bool(scenario.contingency_id)),
        "switching_changed": float(scenario.switching_state != "normal"),
        "queue_project_count": float(len(scenario.queue_project_ids)),
        "reinforcement_count": float(len(scenario.reinforcement_ids)),
        "requested_import_mw": requested_import_mw,
    }


def run_release2(
    *,
    initial_outcomes: list[PhysicsOutcome],
    candidate_scenarios: list[ScenarioDefinition],
    requested_import_mw: float,
    batch_size: int,
    mandatory_contingencies: set[str],
    solve_batch: Callable[[list[ScenarioDefinition]], list[PhysicsOutcome]],
    solve_one: Callable[[ScenarioDefinition], PhysicsOutcome],
    artifact_path: Path | None = None,
    false_safe_limit: float = 0.05,
    solver_budget: int = 128,
) -> dict:
    if requested_import_mw <= 0 or batch_size <= 0 or solver_budget <= 0:
        raise ValueError("Release 2 requires positive demand, batch size and solver budget.")
    if not candidate_scenarios:
        raise ValueError("Release 2 requires an unsolved candidate scenario pool.")
    candidate_hashes = [item.input_hash for item in candidate_scenarios]
    if len(candidate_hashes) != len(set(candidate_hashes)):
        raise ValueError("Release 2 candidate scenarios must be unique by canonical input hash.")
    if len(mandatory_contingencies) > solver_budget:
        raise ValueError("Solver budget cannot be smaller than the mandatory contingency set.")
    bundle = train_surrogates(initial_outcomes)
    predictions = []
    candidate_rows = []
    for scenario in candidate_scenarios:
        result = predict(bundle, _scenario_features(scenario, requested_import_mw))
        capacity = float(result["surrogate_capacity_mw"])
        uncertainty = float(result["uncertainty_span_mw"])
        violation_probability = 1.0 if capacity < requested_import_mw else 0.0
        predictions.append(
            CandidatePrediction(
                scenario=scenario,
                predicted_capacity_mw=capacity,
                uncertainty_span_mw=uncertainty,
                out_of_distribution=bool(result["out_of_distribution"]),
                violation_probability=violation_probability,
                model_disagreement=uncertainty,
            )
        )
        candidate_rows.append(
            {
                "scenario_id": scenario.scenario_id,
                "scenario_sha256": scenario.input_hash,
                **result,
                "selected_for_physics": False,
            }
        )
    selected = select_batch(
        predictions,
        requested_import_mw=requested_import_mw,
        batch_size=min(batch_size, solver_budget),
        mandatory_contingencies=mandatory_contingencies,
    )
    selected_hashes = {item.input_hash for item in selected}
    for row in candidate_rows:
        row["selected_for_physics"] = row["scenario_sha256"] in selected_hashes
    verified = solve_batch(selected)
    verified = [item for item in verified if item.physics_verified]
    verified_by_hash = {item.input_hash: item for item in verified}
    unexpected_hashes = sorted(set(verified_by_hash) - selected_hashes)
    if unexpected_hashes:
        raise ValueError("Physics solver returned outcomes outside the selected Release 2 batch.")
    verified_hashes = set(verified_by_hash) & selected_hashes
    physics_coverage = len(verified_hashes) / len(selected) if selected else 0.0
    mandatory_selected = {
        item.input_hash for item in selected if item.contingency_id in mandatory_contingencies
    }
    mandatory_verified = mandatory_selected & verified_hashes
    mandatory_coverage = (
        len(mandatory_verified) / len(mandatory_selected) if mandatory_selected else 1.0
    )
    combined = initial_outcomes + verified
    updated = train_surrogates(combined)
    promotion = promotion_decision(
        prior_metrics=bundle.registry["metrics"],
        new_metrics=updated.registry["metrics"],
        false_safe_limit=false_safe_limit,
        minimum_mae_improvement_mw=-0.25,
        physics_coverage=physics_coverage,
        mandatory_contingency_coverage=mandatory_coverage,
    )
    rare_budget = max(0, min(16, solver_budget - len(selected)))
    rare = (
        rare_event_search(selected[0], solve_one, iterations=rare_budget)
        if selected and rare_budget >= 2
        else {
            "schema_version": "gridpulse-p4-rare-event-v1",
            "physics_solves": 0,
            "verified_count": 0,
            "worst_outcome": None,
            "credible_bounds": None,
        }
    )
    prior_constraints = {
        item.binding_constraint for item in initial_outcomes if item.physics_verified
    }
    new_constraints = {
        item.binding_constraint for item in verified if item.physics_verified
    } - prior_constraints
    stop = stopping_rule(
        recent_new_constraints=len(new_constraints),
        percentile_delta_mw=abs(
            float(updated.registry["metrics"]["capacity_mae_mw"])
            - float(bundle.registry["metrics"]["capacity_mae_mw"])
        ),
        uncertainty_delta_mw=0.0,
        solver_budget_used=len(selected) + int(rare["physics_solves"]),
        solver_budget=solver_budget,
    )
    artifact = serialize_bundle(updated, artifact_path) if artifact_path else None
    return {
        "schema_version": "gridpulse-release2-v1",
        "public_visibility": "private_internal_only",
        "capacity_claim": False,
        "initial_model_registry": bundle.registry,
        "updated_model_registry": updated.registry,
        "artifact": artifact,
        "active_learning_round": {
            "candidate_count": len(candidate_scenarios),
            "selected_count": len(selected),
            "mandatory_contingencies": sorted(mandatory_contingencies),
            "selected_scenario_ids": [item.scenario_id for item in selected],
            "selected_scenario_hash": canonical_hash(sorted(selected_hashes)),
            "predictions": candidate_rows,
            "physics_outcomes": [asdict(item) for item in verified],
            "physics_coverage": round(physics_coverage, 6),
            "mandatory_contingency_coverage": round(mandatory_coverage, 6),
            "unverified_selected_scenario_hashes": sorted(selected_hashes - verified_hashes),
            "new_constraints": sorted(str(item) for item in new_constraints),
        },
        "rare_event_search": rare,
        "promotion": promotion,
        "stopping": stop,
        "warning": "Surrogate outputs prioritise physics solves and are never grid-capacity results.",
    }
