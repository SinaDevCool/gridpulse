from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ALLOWED_KINDS = {"node", "line", "industrial_site"}


@dataclass(frozen=True)
class ValidationReport:
    valid: bool
    feature_count: int
    errors: tuple[str, ...]
    sha256: str


def _canonical_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def validate_fixture(payload: dict[str, Any]) -> ValidationReport:
    errors: list[str] = []
    features = payload.get("features")
    if payload.get("type") != "FeatureCollection":
        errors.append("Root type must be FeatureCollection.")
    if not isinstance(features, list) or not features:
        errors.append("At least one feature is required.")
        features = []

    seen_ids: set[str] = set()
    for index, feature in enumerate(features):
        feature_id = str(feature.get("id", "")).strip()
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        kind = properties.get("kind")
        if not feature_id:
            errors.append(f"Feature {index} has no id.")
        elif feature_id in seen_ids:
            errors.append(f"Duplicate feature id: {feature_id}.")
        seen_ids.add(feature_id)
        if kind not in ALLOWED_KINDS:
            errors.append(f"Feature {feature_id or index} has unsupported kind {kind!r}.")
        if geometry.get("type") not in {"Point", "LineString", "Polygon", "MultiPolygon"}:
            errors.append(f"Feature {feature_id or index} has unsupported geometry.")
        if properties.get("evidence_class") != "test_fixture":
            errors.append(f"Feature {feature_id or index} must be labelled test_fixture.")

    digest = hashlib.sha256(_canonical_bytes(payload)).hexdigest()
    return ValidationReport(not errors, len(features), tuple(errors), digest)


def build_fixture(input_path: Path, output_path: Path) -> ValidationReport:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    report = validate_fixture(payload)
    if not report.valid:
        raise ValueError("Fixture validation failed: " + " ".join(report.errors))

    output = {
        **payload,
        "metadata": {
            **(payload.get("metadata") or {}),
            "artifact_sha256": report.sha256,
            "record_count": report.feature_count,
            "evidence_boundary": (
                "Synthetic development fixture. It is not operator data and does not establish "
                "available capacity, a connection point, or an energisation date."
            ),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report
