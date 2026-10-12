from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from pathlib import Path

from .backtest import TrainingRow, run_backtest
from .contracts import FeatureSnapshot


def load_training_rows(path: Path) -> list[TrainingRow]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("evidenceType") in {"synthetic", "scenario", "surrogate", "reconstructed_network"}:
        raise ValueError("production forecast training rejects non-real evidence")
    return [TrainingRow(date.fromisoformat(row["deliveryDay"]), {str(k): float(v) for k, v in row["features"].items()}, float(row["redispatchMwh"]), float(row.get("completeness", 1))) for row in payload["rows"]]


def run_backtest_file(input_path: Path, output_path: Path, *, minimum_train: int = 180, test_days: int = 30, folds: int = 3) -> dict[str, object]:
    result = run_backtest(load_training_rows(input_path), minimum_train=minimum_train, test_days=test_days, folds=folds)
    result["inputSha256"] = hashlib.sha256(input_path.read_bytes()).hexdigest()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
    return result


def load_feature_snapshot(path: Path) -> FeatureSnapshot:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return FeatureSnapshot(
        issue_time=datetime.fromisoformat(payload["issueTime"].replace("Z", "+00:00")),
        delivery_day=date.fromisoformat(payload["deliveryDay"]),
        features={str(key): float(value) for key, value in payload["features"].items()},
        source_ids=tuple(int(value) for value in payload["sourceObservationIds"]),
        source_evidence_types=tuple(str(value) for value in payload["sourceEvidenceTypes"]),
        completeness=float(payload["completeness"]),
        region_code=str(payload.get("regionCode", "DE")),
    )
