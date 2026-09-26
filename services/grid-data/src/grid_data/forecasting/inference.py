from __future__ import annotations

from .contracts import FeatureSnapshot, Prediction
from .models import ModelBundle, predict_bundle


def _severity(probability: float) -> str:
    if probability >= 0.8: return "critical"
    if probability >= 0.6: return "high"
    if probability >= 0.35: return "moderate"
    return "low"


def predict(snapshot: FeatureSnapshot, bundle: ModelBundle, *, model_name: str, model_version: str) -> Prediction:
    if snapshot.completeness < 0.75:
        raise ValueError("mandatory input completeness below inference gate")
    probability, p50, p90 = predict_bundle(bundle, snapshot.features)
    ranked = sorted(snapshot.features.items(), key=lambda item: abs(item[1]), reverse=True)[:4]
    drivers = tuple({"metric": key, "value": value} for key, value in ranked)
    confidence = "high" if snapshot.completeness >= 0.95 else "medium" if snapshot.completeness >= 0.85 else "low"
    caveats = ("Regional operating-context forecast; not site-specific available capacity.",)
    return Prediction(snapshot.issue_time, snapshot.delivery_day, probability, p50, p90, _severity(probability), confidence, drivers, caveats, model_name, model_version, snapshot.region_code)
