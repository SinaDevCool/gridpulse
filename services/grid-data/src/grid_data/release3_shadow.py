"""Release 3 shadow validation and governed surrogate lifecycle."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from statistics import mean
from typing import Any

from .p0_foundation import PhysicsOutcome, ScenarioDefinition, canonical_hash
from .p3_surrogate import FEATURES, SurrogateBundle, feature_vector, predict


def feature_importance(bundle: SurrogateBundle) -> list[dict[str, Any]]:
    values = getattr(bundle.capacity, "feature_importances_", None)
    if values is None:
        return []
    rows = [
        {"feature": key, "importance": round(float(values[index]), 6)}
        for index, key in enumerate(FEATURES)
    ]
    return sorted(rows, key=lambda item: (-item["importance"], item["feature"]))


def assess_feature_drift(
    reference_bounds: dict[str, list[float]], current_features: list[dict[str, float]]
) -> dict[str, Any]:
    if not current_features:
        raise ValueError("Drift assessment requires current feature rows.")
    vectors = [feature_vector(item) for item in current_features]
    details = []
    for index, key in enumerate(FEATURES):
        values = [item[index] for item in vectors]
        low, high = reference_bounds[key]
        scale = max(float(high) - float(low), 1e-9)
        outside = sum(value < low or value > high for value in values) / len(values)
        reference_midpoint = (float(low) + float(high)) / 2
        normalized_shift = abs(mean(values) - reference_midpoint) / scale
        details.append(
            {
                "feature": key,
                "outside_training_range_fraction": round(outside, 6),
                "normalized_mean_shift": round(normalized_shift, 6),
                "drifted": outside > 0.1 or normalized_shift > 0.75,
            }
        )
    drifted = [item["feature"] for item in details if item["drifted"]]
    return {
        "schema_version": "gridpulse-release3-drift-v1",
        "status": "drift_detected" if drifted else "stable",
        "drifted_features": drifted,
        "details": details,
    }


def evaluate_shadow_run(
    bundle: SurrogateBundle,
    scenarios: list[ScenarioDefinition],
    outcomes: list[PhysicsOutcome],
    *,
    requested_import_mw: float,
    mandatory_contingencies: set[str],
) -> dict[str, Any]:
    if requested_import_mw <= 0:
        raise ValueError("Shadow validation requires positive requested import.")
    by_scenario = {item.scenario_id: item for item in outcomes if item.physics_verified}
    rows = []
    errors = []
    false_safe = 0
    ood = 0
    binding_matches = 0
    covered_contingencies = set()
    current_features = []
    for scenario in scenarios:
        outcome = by_scenario.get(scenario.scenario_id)
        if not outcome or outcome.import_capacity_mw is None:
            continue
        features = dict(outcome.features)
        features["requested_import_mw"] = requested_import_mw
        result = predict(bundle, features)
        prediction = float(result["surrogate_capacity_mw"])
        truth = float(outcome.import_capacity_mw)
        error = prediction - truth
        is_false_safe = prediction >= requested_import_mw and truth < requested_import_mw
        false_safe += int(is_false_safe)
        ood += int(result["out_of_distribution"])
        binding_matches += int(result["binding_constraint"] == outcome.binding_constraint)
        if scenario.contingency_id:
            covered_contingencies.add(scenario.contingency_id)
        errors.append(error)
        current_features.append(features)
        rows.append(
            {
                "scenario_id": scenario.scenario_id,
                "scenario_sha256": scenario.input_hash,
                "surrogate_prediction_mw": prediction,
                "physics_verified_capacity_mw": truth,
                "absolute_error_mw": round(abs(error), 6),
                "false_safe": is_false_safe,
                "out_of_distribution": bool(result["out_of_distribution"]),
                "uncertainty_span_mw": result["uncertainty_span_mw"],
                "predicted_binding_constraint": result["binding_constraint"],
                "verified_binding_constraint": outcome.binding_constraint,
                "requires_physics_verification": True,
                "display_as_capacity": False,
            }
        )
    if not rows:
        raise ValueError("Shadow run contains no matched physics-verified outcomes.")
    ordered_errors = sorted(abs(item) for item in errors)
    p95_index = min(len(ordered_errors) - 1, int(0.95 * len(ordered_errors)))
    required = set(mandatory_contingencies)
    coverage = len(rows) / len(scenarios) if scenarios else 0
    metrics = {
        "scenario_count": len(scenarios),
        "verified_count": len(rows),
        "physics_coverage": round(coverage, 6),
        "mae_mw": round(mean(abs(item) for item in errors), 6),
        "p95_absolute_error_mw": round(ordered_errors[p95_index], 6),
        "bias_mw": round(mean(errors), 6),
        "false_safe_rate": round(false_safe / len(rows), 6),
        "out_of_distribution_rate": round(ood / len(rows), 6),
        "binding_accuracy": round(binding_matches / len(rows), 6),
        "mandatory_contingency_coverage": round(
            len(required & covered_contingencies) / len(required), 6
        )
        if required
        else 1.0,
        "binding_distribution": dict(
            Counter(item["verified_binding_constraint"] or "unknown" for item in rows)
        ),
    }
    drift = assess_feature_drift(bundle.registry["feature_bounds"], current_features)
    return {
        "schema_version": "gridpulse-release3-shadow-run-v1",
        "model_dataset_hash": bundle.registry["dataset_hash"],
        "validation_class": outcomes[0].validation_class,
        "metrics": metrics,
        "drift": drift,
        "observations": rows,
        "feature_importance": feature_importance(bundle),
        "capacity_claim": False,
        "public_visibility": "private_internal_only",
    }


def champion_decision(
    shadow: dict[str, Any],
    *,
    operator_reviewed: bool,
    operator_training_authorized: bool,
    minimum_verified_cases: int = 30,
    maximum_mae_mw: float = 5.0,
    maximum_p95_error_mw: float = 10.0,
    maximum_false_safe_rate: float = 0.01,
    maximum_ood_rate: float = 0.1,
) -> dict[str, Any]:
    metrics = shadow["metrics"]
    validation_class = shadow["validation_class"]
    gates = {
        "operator_validation_class": validation_class
        in {"operator_model_reconciled", "operator_reviewed"},
        "operator_training_authorized": operator_training_authorized,
        "operator_reviewed": operator_reviewed,
        "minimum_shadow_cases": metrics["verified_count"] >= minimum_verified_cases,
        "physics_coverage": metrics["physics_coverage"] >= 0.99,
        "mae": metrics["mae_mw"] <= maximum_mae_mw,
        "p95_error": metrics["p95_absolute_error_mw"] <= maximum_p95_error_mw,
        "false_safe": metrics["false_safe_rate"] <= maximum_false_safe_rate,
        "out_of_distribution": metrics["out_of_distribution_rate"] <= maximum_ood_rate,
        "mandatory_contingencies": metrics["mandatory_contingency_coverage"] == 1.0,
        "feature_drift": shadow["drift"]["status"] == "stable",
    }
    approved = all(gates.values())
    payload = {
        "schema_version": "gridpulse-release3-champion-decision-v1",
        "decision": "approve_internal_champion" if approved else "retain_challenger",
        "approved_for": "scenario_prioritisation_only" if approved else None,
        "capacity_claim": False,
        "operator_confirmation_created": False,
        "gates": gates,
        "failed_gates": [key for key, value in gates.items() if not value],
        "thresholds": {
            "minimum_verified_cases": minimum_verified_cases,
            "maximum_mae_mw": maximum_mae_mw,
            "maximum_p95_error_mw": maximum_p95_error_mw,
            "maximum_false_safe_rate": maximum_false_safe_rate,
            "maximum_ood_rate": maximum_ood_rate,
        },
    }
    payload["decision_sha256"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return payload


def release3_report(
    bundle: SurrogateBundle,
    scenarios: list[ScenarioDefinition],
    outcomes: list[PhysicsOutcome],
    *,
    requested_import_mw: float,
    mandatory_contingencies: set[str],
    operator_reviewed: bool,
    operator_training_authorized: bool,
) -> dict[str, Any]:
    shadow = evaluate_shadow_run(
        bundle,
        scenarios,
        outcomes,
        requested_import_mw=requested_import_mw,
        mandatory_contingencies=mandatory_contingencies,
    )
    decision = champion_decision(
        shadow,
        operator_reviewed=operator_reviewed,
        operator_training_authorized=operator_training_authorized,
    )
    return {
        "schema_version": "gridpulse-release3-v1",
        "shadow": shadow,
        "champion_decision": decision,
        "report_sha256": canonical_hash(
            {"shadow": shadow, "champion_decision": decision}
        ),
        "warning": "Shadow predictions are internal diagnostics; physics and operator review remain authoritative.",
    }
