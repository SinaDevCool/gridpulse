"""P3 physics-labelled surrogate models. AI prioritises; physics remains authoritative."""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .p0_foundation import PhysicsOutcome, canonical_hash

FEATURES = (
    "demand_factor",
    "renewable_factor",
    "accepted_connections_mw",
    "reinforcement_delay_years",
    "battery_availability",
    "flexible_load_availability",
    "battery_dispatch_mw",
    "flexible_load_reduction_mw",
    "contingency_present",
    "switching_changed",
    "queue_project_count",
    "reinforcement_count",
)

FEATURE_DEFAULTS = {
    "battery_availability": 1.0,
    "flexible_load_availability": 1.0,
    "battery_dispatch_mw": 0.0,
    "flexible_load_reduction_mw": 0.0,
    "contingency_present": 0.0,
    "switching_changed": 0.0,
    "queue_project_count": 0.0,
    "reinforcement_count": 0.0,
}


@dataclass
class SurrogateBundle:
    feasibility: Any
    capacity: Any
    binding: Any
    binding_labels: list[str]
    registry: dict[str, Any]
    uncertainty_model: Any


def _dependencies():
    try:
        import numpy as np
        from sklearn.ensemble import (
            GradientBoostingClassifier,
            GradientBoostingRegressor,
            RandomForestRegressor,
        )
        from sklearn.metrics import accuracy_score, mean_absolute_error
    except ImportError as error:
        raise RuntimeError("Install the 'ml' optional dependency to train P3 models.") from error
    return (
        np,
        GradientBoostingClassifier,
        GradientBoostingRegressor,
        RandomForestRegressor,
        accuracy_score,
        mean_absolute_error,
    )


def training_rows(outcomes: list[PhysicsOutcome]) -> list[PhysicsOutcome]:
    return [
        item
        for item in outcomes
        if item.physics_verified
        and item.import_capacity_mw is not None
        and all(key in item.features for key in FEATURES[:4])
    ]


def feature_vector(features: dict[str, float]) -> list[float]:
    missing = [key for key in FEATURES[:4] if key not in features]
    if missing:
        raise ValueError(f"Missing required surrogate features: {', '.join(missing)}")
    values = [float(features.get(key, FEATURE_DEFAULTS.get(key, 0.0))) for key in FEATURES]
    if any(not (-1e9 < value < 1e9) for value in values):
        raise ValueError("Surrogate features must be finite and bounded numeric values.")
    return values


def train_surrogates(
    outcomes: list[PhysicsOutcome],
    *,
    holdout_scenario_prefix: str = "holdout",
    random_state: int = 41,
    operator_trained: bool = False,
) -> SurrogateBundle:
    np, GBC, GBR, RFR, accuracy, mae = _dependencies()
    rows = training_rows(outcomes)
    explicit_test = [item for item in rows if item.scenario_id.startswith(holdout_scenario_prefix)]
    if explicit_test:
        train = [item for item in rows if item not in explicit_test]
        test = explicit_test
        split_method = "scenario_prefix_holdout"
    else:
        ordered = sorted(rows, key=lambda item: canonical_hash(item.scenario_id))
        holdout_count = max(2, len(ordered) // 5)
        train, test = ordered[:-holdout_count], ordered[-holdout_count:]
        split_method = "deterministic_hash_holdout"
    if len(train) < 8 or len(test) < 2:
        raise ValueError("At least eight physics-verified training rows are required.")
    matrix = lambda items: np.array([feature_vector(item.features) for item in items], dtype=float)
    x_train, x_test = matrix(train), matrix(test)
    y_capacity = np.array([item.import_capacity_mw for item in train], dtype=float)
    y_feasible = np.array([int(item.feasible) for item in train])
    labels = sorted({item.binding_constraint or "unknown" for item in train})
    y_binding = np.array([labels.index(item.binding_constraint or "unknown") for item in train])
    feasibility = (
        GBC(random_state=random_state).fit(x_train, y_feasible)
        if len(set(y_feasible)) > 1
        else None
    )
    capacity = GBR(random_state=random_state, loss="huber").fit(x_train, y_capacity)
    binding = (
        GBC(random_state=random_state).fit(x_train, y_binding) if len(set(y_binding)) > 1 else None
    )
    ensemble = RFR(n_estimators=32, random_state=random_state).fit(x_train, y_capacity)
    predictions = capacity.predict(x_test)
    truth = np.array([item.import_capacity_mw for item in test], dtype=float)
    absolute_errors = np.abs(truth - predictions)
    requested = np.array(
        [float(item.features.get("requested_import_mw", item.import_capacity_mw)) for item in test]
    )
    false_safe = np.logical_and(predictions >= requested, truth < requested)
    registry = {
        "schema_version": "gridpulse-p3-model-registry-v1",
        "dataset_hash": canonical_hash([asdict(item) for item in rows]),
        "feature_schema": list(FEATURES),
        "algorithm": "gradient_boosting",
        "random_state": random_state,
        "split_method": split_method,
        "training_count": len(train),
        "holdout_count": len(test),
        "training_scenario_hash": canonical_hash(sorted(item.input_hash for item in train)),
        "holdout_scenario_hash": canonical_hash(sorted(item.input_hash for item in test)),
        "metrics": {
            "capacity_mae_mw": round(float(mae(truth, predictions)), 4),
            "capacity_p95_absolute_error_mw": round(float(np.percentile(absolute_errors, 95)), 4),
            "capacity_label_range_mw": round(float(y_capacity.max() - y_capacity.min()), 4),
            "unique_capacity_labels": len({float(item) for item in y_capacity}),
            "false_safe_rate": round(float(false_safe.mean()), 6),
            "feasibility_accuracy": round(
                float(accuracy([int(item.feasible) for item in test], feasibility.predict(x_test))),
                4,
            )
            if feasibility
            else None,
        },
        "approved_use": "scenario prioritisation and explanation before mandatory physics verification",
        "prohibited_use": "representing surrogate output as available or operator-confirmed grid capacity",
        "training_validation_classes": sorted({item.validation_class for item in rows}),
        "operator_trained": operator_trained,
        "feature_bounds": {
            key: [float(x_train[:, index].min()), float(x_train[:, index].max())]
            for index, key in enumerate(FEATURES)
        },
        "uncertainty_policy": {
            "measure": "random_forest_tree_prediction_span",
            "physics_verification_required": True,
            "out_of_distribution_action": "route_to_physics",
        },
    }
    return SurrogateBundle(feasibility, capacity, binding, labels, registry, ensemble)


def predict(bundle: SurrogateBundle, features: dict[str, float]) -> dict:
    np, *_ = _dependencies()
    vector = feature_vector(features)
    x = np.array([vector], dtype=float)
    trees = bundle.uncertainty_model.estimators_
    tree_values = [float(tree.predict(x)[0]) for tree in trees]
    bounds = bundle.registry["feature_bounds"]
    ood = any(
        not bounds[key][0] <= vector[index] <= bounds[key][1] for index, key in enumerate(FEATURES)
    )
    disagreement = max(tree_values) - min(tree_values)
    ranges = {key: max(bounds[key][1] - bounds[key][0], 1e-9) for key in FEATURES}
    ood_distance = max(
        max(
            bounds[key][0] - vector[index],
            0.0,
            vector[index] - bounds[key][1],
        )
        / ranges[key]
        for index, key in enumerate(FEATURES)
    )
    return {
        "surrogate_capacity_mw": round(float(bundle.capacity.predict(x)[0]), 3),
        "feasibility_probability": round(float(bundle.feasibility.predict_proba(x)[0, 1]), 4)
        if bundle.feasibility
        else None,
        "binding_constraint": bundle.binding_labels[int(bundle.binding.predict(x)[0])]
        if bundle.binding
        else bundle.binding_labels[0],
        "uncertainty_span_mw": round(disagreement, 3),
        "out_of_distribution": ood,
        "out_of_distribution_distance": round(float(ood_distance), 6),
        "requires_physics_verification": True,
        "display_as_capacity": False,
    }


def serialize_bundle(bundle: SurrogateBundle, path: Path) -> dict[str, Any]:
    """Persist an internal-only trusted artifact and return its immutable manifest."""
    try:
        import joblib
    except ImportError as error:
        raise RuntimeError("Install the 'ml' optional dependency to persist P3 models.") from error
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path)
    content = path.read_bytes()
    return {
        "schema_version": "gridpulse-p3-artifact-v1",
        "artifact_sha256": hashlib.sha256(content).hexdigest(),
        "size_bytes": len(content),
        "format": "joblib-internal-trusted-only",
        "dataset_hash": bundle.registry["dataset_hash"],
        "public_visibility": "private_internal_only",
    }
