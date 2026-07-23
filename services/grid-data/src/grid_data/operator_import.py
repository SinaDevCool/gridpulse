from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ImportValidation:
    valid: bool
    record_count: int
    errors: tuple[str, ...]


def validate_operator_import_manifest(manifest: dict[str, Any]) -> ImportValidation:
    errors: list[str] = []
    records = manifest.get("records")
    if not isinstance(records, list):
        records = []
        errors.append("records must be an array")
    if manifest.get("reuse_status") != "permitted":
        errors.append("reuse_status must be permitted")
    if manifest.get("redistribution_permitted") is not True:
        errors.append("redistribution_permitted must be true")
    if not str(manifest.get("reuse_basis", "")).strip():
        errors.append("reuse_basis is required")
    if not str(manifest.get("evidence_url", "")).startswith("https://"):
        errors.append("an HTTPS evidence_url is required")
    if not str(manifest.get("source_id", "")).strip():
        errors.append("source_id is required")
    seen: set[str] = set()
    for index, record in enumerate(records):
        record_id = str(record.get("source_record_id", "")).strip()
        if not record_id:
            errors.append(f"record {index} has no source_record_id")
        elif record_id in seen:
            errors.append(f"duplicate source_record_id: {record_id}")
        seen.add(record_id)
        if not isinstance(record.get("latitude"), (int, float)) or not isinstance(
            record.get("longitude"), (int, float)
        ):
            errors.append(f"record {index} has no exact coordinate")
        if record.get("direction") not in {"demand", "generation"}:
            errors.append(f"record {index} has no explicit direction")
    return ImportValidation(not errors, len(records), tuple(errors))


def validate_operator_import_file(input_path: Path, output_path: Path) -> dict[str, Any]:
    manifest = json.loads(input_path.read_text(encoding="utf-8"))
    validation = validate_operator_import_manifest(manifest)
    report = {
        "schema_version": "operator-import-validation-v1",
        "source_id": manifest.get("source_id"),
        "valid": validation.valid,
        "record_count": validation.record_count,
        "errors": list(validation.errors),
        "publication_boundary": (
            "Validation does not publish records. The database reuse authorization and "
            "human node-match review remain mandatory."
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report
