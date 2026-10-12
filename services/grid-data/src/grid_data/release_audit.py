from __future__ import annotations

import hashlib
import json
from collections import Counter
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .osm import _numbers

ALLOWED_KINDS = {"node", "line", "industrial_site", "generation_asset", "storage_asset"}
ALLOWED_EVIDENCE = {
    "official_operator",
    "official_regulatory",
    "official_public",
    "open_mapping",
    "test_fixture",
}


def _positions(value: Any) -> Iterable[tuple[float, float]]:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        yield float(value[0]), float(value[1])
    elif isinstance(value, list):
        for item in value:
            yield from _positions(item)


def audit_release(input_path: Path, output_path: Path) -> dict[str, Any]:
    raw = input_path.read_bytes()
    document = json.loads(raw)
    metadata = document.get("metadata") or {}
    features = document.get("features")
    errors: list[str] = []
    warnings: list[str] = []
    if document.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise ValueError("release must be a GeoJSON FeatureCollection")
    identifiers: set[str] = set()
    kinds: Counter[str] = Counter()
    for index, feature in enumerate(features):
        identifier = str(feature.get("id") or "")
        properties = feature.get("properties") or {}
        kind = properties.get("kind")
        evidence = properties.get("evidence_class")
        if not identifier:
            errors.append(f"feature {index} has no id")
        elif identifier in identifiers:
            errors.append(f"duplicate feature id: {identifier}")
        identifiers.add(identifier)
        if kind not in ALLOWED_KINDS:
            errors.append(f"{identifier or index}: unsupported kind {kind!r}")
        else:
            kinds[kind] += 1
        if evidence not in ALLOWED_EVIDENCE:
            errors.append(f"{identifier or index}: unsupported evidence class {evidence!r}")
        for longitude, latitude in _positions((feature.get("geometry") or {}).get("coordinates")):
            if not (5 <= longitude <= 16 and 47 <= latitude <= 56):
                errors.append(f"{identifier or index}: coordinate outside Germany bounds")
                break
        for voltage in properties.get("voltage_kv") or []:
            if not isinstance(voltage, (int, float)) or voltage <= 0 or voltage > 1000:
                errors.append(f"{identifier or index}: invalid voltage {voltage!r}")
            elif voltage > 500:
                errors.append(
                    f"{identifier or index}: implausible German grid voltage {voltage!r} kV"
                )
        raw_voltage = (properties.get("raw_tags") or {}).get("voltage")
        if raw_voltage:
            expected_voltage = _numbers(str(raw_voltage))
            actual_voltage = properties.get("voltage_kv") or []
            if expected_voltage != actual_voltage:
                errors.append(
                    f"{identifier or index}: normalized voltage does not match raw source "
                    f"({actual_voltage!r} != {expected_voltage!r})"
                )
        elif properties.get("voltage_kv"):
            warnings.append(f"{identifier or index}: voltage lacks a raw source value")
        if properties.get("capacity_state") in {
            "published_exact",
            "published_band",
        } and evidence not in {"official_operator", "official_regulatory"}:
            errors.append(f"{identifier or index}: published capacity lacks official evidence")
    if metadata.get("record_count") != len(features):
        errors.append("metadata record_count does not match feature count")
    for required in ("publisher", "attribution", "freshness", "evidence_boundary"):
        if not metadata.get(required):
            errors.append(f"metadata is missing {required}")
    if not kinds.get("node"):
        warnings.append("release contains no candidate nodes")
    rule_counts: Counter[str] = Counter()
    for issue in errors + warnings:
        if "normalized voltage" in issue:
            rule_counts["voltage_normalization"] += 1
        elif "implausible German grid voltage" in issue:
            rule_counts["voltage_plausibility"] += 1
        elif "invalid voltage" in issue:
            rule_counts["voltage_validity"] += 1
        elif "coordinate outside" in issue:
            rule_counts["coordinate_bounds"] += 1
        elif "duplicate feature" in issue:
            rule_counts["duplicate_identifier"] += 1
        elif "raw source value" in issue:
            rule_counts["voltage_source_traceability"] += 1
        else:
            rule_counts["other"] += 1
    report = {
        "valid": not errors,
        "audited_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "input": str(input_path),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "feature_count": len(features),
        "kind_counts": dict(sorted(kinds.items())),
        "rule_counts": dict(sorted(rule_counts.items())),
        "errors": errors,
        "warnings": warnings,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report
