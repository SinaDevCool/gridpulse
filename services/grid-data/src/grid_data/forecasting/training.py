from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .backtest import TrainingRow, run_backtest
from .models import train_candidate
from .targets import percentile


@dataclass(frozen=True)
class TrainedArtifact:
    path: Path
    sha256: str
    version: str
    threshold_mwh: float
    backtest: dict[str, object]


def train_promoted_model(rows: list[TrainingRow], artifact_path: Path, *, version: str | None = None) -> TrainedArtifact:
    """Train and serialize only after every promotion gate passes."""
    import joblib

    report = run_backtest(rows)
    if not report["promotion"]["accepted"]:
        raise ValueError("candidate model did not pass production promotion gates")
    ordered = sorted(rows, key=lambda row: row.delivery_day)
    threshold = percentile([row.redispatch_mwh for row in ordered], 0.8)
    labels = [int(row.redispatch_mwh > threshold) for row in ordered]
    bundle = train_candidate([row.features for row in ordered], labels, [row.redispatch_mwh for row in ordered])
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"bundle": bundle, "threshold_mwh": threshold, "feature_schema_version": "gridpulse-grid-stress-features-v1", "training_cutoff": ordered[-1].delivery_day.isoformat(), "backtest": report}, artifact_path)
    digest = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
    return TrainedArtifact(artifact_path, digest, version or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"), threshold, report)


def write_model_manifest(artifact: TrainedArtifact, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"schemaVersion": "gridpulse-grid-stress-model-manifest-v1", "modelName": "day-ahead-regional-grid-stress", "version": artifact.version, "artifactUri": str(artifact.path), "artifactSha256": artifact.sha256, "thresholdMwh": artifact.threshold_mwh, "promotion": artifact.backtest["promotion"]}, indent=2, sort_keys=True), encoding="utf-8")


def load_promoted_model(artifact_path: Path, manifest_path: Path):
    import joblib

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    digest = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
    if digest != manifest["artifactSha256"] or not manifest["promotion"]["accepted"]:
        raise ValueError("model artifact is not an intact accepted model")
    return joblib.load(artifact_path)["bundle"], manifest
