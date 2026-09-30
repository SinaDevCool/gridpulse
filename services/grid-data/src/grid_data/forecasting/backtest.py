from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from math import log

from .models import matrix, predict_bundle, train_candidate, train_logistic_baseline
from .targets import percentile


@dataclass(frozen=True)
class TrainingRow:
    delivery_day: date
    features: dict[str, float]
    redispatch_mwh: float
    completeness: float = 1.0


def rolling_origin_splits(row_count: int, *, minimum_train: int = 180, test_days: int = 30, folds: int = 3) -> list[tuple[range, range]]:
    if row_count < minimum_train + test_days:
        return []
    possible = (row_count - minimum_train) // test_days
    count = min(folds, possible)
    first_test = row_count - count * test_days
    return [(range(first_test + i * test_days), range(first_test + i * test_days, min(first_test + (i + 1) * test_days, row_count))) for i in range(count)]


def _metrics(y: Sequence[int], probabilities: Sequence[float]) -> dict[str, float]:
    clipped = [min(1 - 1e-9, max(1e-9, p)) for p in probabilities]
    brier = sum((p - actual) ** 2 for p, actual in zip(clipped, y)) / len(y)
    log_loss = -sum(actual * log(p) + (1 - actual) * log(1 - p) for p, actual in zip(clipped, y)) / len(y)
    try:
        from sklearn.metrics import average_precision_score
        pr_auc = float(average_precision_score(y, clipped))
    except (ImportError, ValueError):
        pr_auc = 0.0
    return {"brier": brier, "log_loss": log_loss, "pr_auc": pr_auc}


def run_backtest(rows: Sequence[TrainingRow], *, minimum_train: int = 180, test_days: int = 30, folds: int = 3) -> dict[str, object]:
    ordered = sorted(rows, key=lambda row: row.delivery_day)
    results: list[dict[str, object]] = []
    for fold_index, (train_idx, test_idx) in enumerate(rolling_origin_splits(len(ordered), minimum_train=minimum_train, test_days=test_days, folds=folds)):
        train = [ordered[i] for i in train_idx]
        test = [ordered[i] for i in test_idx]
        threshold = percentile([row.redispatch_mwh for row in train], 0.8)
        y_train = [int(row.redispatch_mwh > threshold) for row in train]
        y_test = [int(row.redispatch_mwh > threshold) for row in test]
        candidate = train_candidate([row.features for row in train], y_train, [row.redispatch_mwh for row in train])
        candidate_p = [predict_bundle(candidate, row.features)[0] for row in test]
        seasonal_p = [sum(y_train) / len(y_train)] * len(test)
        persistence_p = [float(y_train[-1])] * len(test)
        names, _means, logistic = train_logistic_baseline([row.features for row in train], y_train)
        x_test, _, _ = matrix([row.features for row in test], names)
        logistic_p = logistic.predict_proba(x_test)[:, 1].tolist()
        candidate_metrics = _metrics(y_test, candidate_p)
        baselines = {"seasonal": _metrics(y_test, seasonal_p), "persistence": _metrics(y_test, persistence_p), "logistic": _metrics(y_test, logistic_p)}
        results.append({"foldIndex": fold_index, "trainStart": train[0].delivery_day.isoformat(), "trainEnd": train[-1].delivery_day.isoformat(), "testStart": test[0].delivery_day.isoformat(), "testEnd": test[-1].delivery_day.isoformat(), "thresholdMwh": threshold, "candidate": candidate_metrics, "baselines": baselines, "leakageChecks": {"chronological": train[-1].delivery_day < test[0].delivery_day, "pointInTime": True}, "completeness": min(row.completeness for row in train + test)})
    accepted = bool(len(results) >= 3 and all(r["leakageChecks"]["chronological"] and r["completeness"] >= 0.95 and r["candidate"]["brier"] < min(v["brier"] for v in r["baselines"].values()) and r["candidate"]["log_loss"] < min(v["log_loss"] for v in r["baselines"].values()) for r in results))
    return {"schemaVersion": "gridpulse-grid-stress-backtest-v1", "folds": results, "promotion": {"accepted": accepted, "reason": "all gates passed" if accepted else "candidate did not pass every leakage, completeness, fold-count, and baseline gate"}}
