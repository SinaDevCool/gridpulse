from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any


@dataclass
class ModelBundle:
    feature_names: tuple[str, ...]
    classifier: Any
    p50_model: Any
    p90_model: Any
    training_means: dict[str, float]


def matrix(rows: Sequence[dict[str, float]], feature_names: Sequence[str] | None = None) -> tuple[Any, tuple[str, ...], dict[str, float]]:
    import numpy as np

    names = tuple(feature_names or sorted({key for row in rows for key in row}))
    means = {name: float(np.mean([row[name] for row in rows if name in row])) if any(name in row for row in rows) else 0.0 for name in names}
    return np.asarray([[row.get(name, means[name]) for name in names] for row in rows], dtype=float), names, means


def train_candidate(features: Sequence[dict[str, float]], labels: Sequence[int], targets: Sequence[float]) -> ModelBundle:
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor

    x, names, means = matrix(features)
    if len(set(labels)) < 2:
        raise ValueError("training labels must contain both classes")
    base = HistGradientBoostingClassifier(max_depth=4, learning_rate=0.05, max_iter=200, random_state=42)
    classifier = CalibratedClassifierCV(base, method="sigmoid", cv=3).fit(x, labels)
    p50 = HistGradientBoostingRegressor(loss="quantile", quantile=0.5, max_depth=4, random_state=42).fit(x, targets)
    p90 = HistGradientBoostingRegressor(loss="quantile", quantile=0.9, max_depth=4, random_state=42).fit(x, targets)
    return ModelBundle(names, classifier, p50, p90, means)


def train_logistic_baseline(features: Sequence[dict[str, float]], labels: Sequence[int]):
    from sklearn.linear_model import LogisticRegression

    x, names, means = matrix(features)
    return names, means, LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42).fit(x, labels)


def predict_bundle(bundle: ModelBundle, features: dict[str, float]) -> tuple[float, float, float]:
    import numpy as np

    x = np.asarray([[features.get(name, bundle.training_means[name]) for name in bundle.feature_names]])
    probability = float(bundle.classifier.predict_proba(x)[0, 1])
    p50 = max(0.0, float(bundle.p50_model.predict(x)[0]))
    p90 = max(p50, float(bundle.p90_model.predict(x)[0]))
    return probability, p50, p90
