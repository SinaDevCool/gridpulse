"""Benchmark D: calculated-capacity outcome backtest against approved references."""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

from .benchmark_c import _trusted_signature_valid

SCHEMA_VERSION = "gridpulse-benchmark-d-v1"
CAPACITY_FIELDS = ("n0_import_mw", "firm_import_mw")


def _sha256(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _fixture() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    predictions = []
    references = []
    rows = (
        ("urban-winter", "node-u1", 5.0, 4.0, "line_thermal_loading"),
        ("urban-summer", "node-u1", 6.2, 5.1, "minimum_bus_voltage"),
        ("rural-winter", "node-r1", 3.4, 2.7, "transformer_thermal_loading"),
        ("rural-summer", "node-r1", 4.1, 3.3, "line_thermal_loading"),
    )
    for index, (case_id, node_id, n0, firm, constraint) in enumerate(rows):
        predictions.append(
            {
                "case_id": case_id,
                "node_id": node_id,
                "n0_import_mw": n0,
                "firm_import_mw": firm,
                "binding_constraint": constraint,
            }
        )
        references.append(
            {
                "case_id": case_id,
                "node_id": node_id,
                "n0_import_mw": round(n0 + (0.1 if index % 2 == 0 else -0.05), 3),
                "firm_import_mw": round(firm + (0.08 if index % 2 == 0 else -0.04), 3),
                "binding_constraint": constraint,
            }
        )
    evidence = {
        "evidence_origin": "synthetic_fixture",
        "outcome_type": "synthetic_capacity_outcomes",
        "independently_derived_reference": False,
        "operator_approved": False,
        "permission_to_use": True,
        "prediction_results_sha256": _sha256(predictions),
        "operator_reference_sha256": _sha256(references),
        "label": "Synthetic outcome rehearsal — no operator or location claim",
    }
    return predictions, references, evidence


def _load_rows(path: Path, label: str) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not payload or not all(isinstance(row, dict) for row in payload):
        raise ValueError(f"{label} must be a non-empty JSON array of objects.")
    return payload


def _validate_rows(rows: list[dict[str, Any]], label: str) -> None:
    required = {"case_id", "node_id", "binding_constraint", *CAPACITY_FIELDS}
    keys = []
    for row in rows:
        if not required <= row.keys():
            raise ValueError(f"{label} rows are missing required capacity fields.")
        key = (str(row["case_id"]), str(row["node_id"]))
        keys.append(key)
        for field in CAPACITY_FIELDS:
            value = float(row[field])
            if not math.isfinite(value) or value < 0:
                raise ValueError(f"{label} contains an invalid {field} value.")
    if len(keys) != len(set(keys)):
        raise ValueError(f"{label} contains duplicate case/node keys.")


def _percentile_95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def build_benchmark_d_artifact(
    output: Path,
    *,
    predictions_path: Path | None = None,
    references_path: Path | None = None,
    evidence_path: Path | None = None,
    trusted_public_key_path: Path | None = None,
    minimum_cases: int = 4,
    minimum_coverage: float = 0.95,
    capacity_mae_limit_mw: float = 0.25,
    capacity_p95_limit_mw: float = 0.5,
    unsafe_overstatement_tolerance_mw: float = 0.25,
    minimum_constraint_accuracy: float = 0.95,
) -> dict[str, Any]:
    supplied = (predictions_path, references_path, evidence_path)
    if any(supplied) and not all(supplied):
        raise ValueError("Prediction, reference and evidence paths must be supplied together.")
    if minimum_cases <= 0 or not 0 < minimum_coverage <= 1:
        raise ValueError("Benchmark D coverage thresholds are invalid.")
    if (
        capacity_mae_limit_mw <= 0
        or capacity_p95_limit_mw <= 0
        or unsafe_overstatement_tolerance_mw < 0
        or not 0 <= minimum_constraint_accuracy <= 1
    ):
        raise ValueError("Benchmark D acceptance thresholds are invalid.")

    if all(supplied):
        predictions = _load_rows(predictions_path, "Predictions")  # type: ignore[arg-type]
        references = _load_rows(references_path, "References")  # type: ignore[arg-type]
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))  # type: ignore[union-attr]
        if not isinstance(evidence, dict):
            raise ValueError("Evidence manifest must be a JSON object.")
        fixture_mode = False
    else:
        predictions, references, evidence = _fixture()
        fixture_mode = True
    _validate_rows(predictions, "Predictions")
    _validate_rows(references, "References")

    prediction_index = {
        (str(row["case_id"]), str(row["node_id"])): row for row in predictions
    }
    pairs = [
        (prediction_index.get((str(row["case_id"]), str(row["node_id"]))), row)
        for row in references
    ]
    matched = [(prediction, reference) for prediction, reference in pairs if prediction is not None]
    coverage = len(matched) / len(references)
    metric_results = {}
    unsafe_keys: set[str] = set()
    for field in CAPACITY_FIELDS:
        errors = [float(pred[field]) - float(ref[field]) for pred, ref in matched]
        absolute = [abs(value) for value in errors]
        unsafe = [
            f"{pred['case_id']}::{pred['node_id']}"
            for pred, ref in matched
            if float(pred[field]) - float(ref[field]) > unsafe_overstatement_tolerance_mw
        ]
        unsafe_keys.update(unsafe)
        metric_results[field] = {
            "mae_mw": round(mean(absolute), 6) if absolute else None,
            "p95_absolute_error_mw": round(_percentile_95(absolute), 6) if absolute else None,
            "bias_mw": round(mean(errors), 6) if errors else None,
            "maximum_overstatement_mw": round(max([0.0, *errors]), 6),
            "unsafe_overstatement_count": len(unsafe),
            "unsafe_overstatement_rate": round(len(unsafe) / len(matched), 6)
            if matched
            else None,
        }
    constraint_matches = sum(
        str(pred["binding_constraint"]) == str(ref["binding_constraint"])
        for pred, ref in matched
    )
    constraint_accuracy = constraint_matches / len(matched) if matched else 0.0
    numerical_gates = {
        "minimum_case_count": len(references) >= minimum_cases,
        "reference_coverage": coverage >= minimum_coverage,
        "n0_mae": metric_results["n0_import_mw"]["mae_mw"] is not None
        and metric_results["n0_import_mw"]["mae_mw"] <= capacity_mae_limit_mw,
        "firm_mae": metric_results["firm_import_mw"]["mae_mw"] is not None
        and metric_results["firm_import_mw"]["mae_mw"] <= capacity_mae_limit_mw,
        "n0_p95": metric_results["n0_import_mw"]["p95_absolute_error_mw"] is not None
        and metric_results["n0_import_mw"]["p95_absolute_error_mw"] <= capacity_p95_limit_mw,
        "firm_p95": metric_results["firm_import_mw"]["p95_absolute_error_mw"] is not None
        and metric_results["firm_import_mw"]["p95_absolute_error_mw"]
        <= capacity_p95_limit_mw,
        "zero_unsafe_overstatements": not unsafe_keys,
        "binding_constraint_accuracy": constraint_accuracy >= minimum_constraint_accuracy,
    }
    numerical_passed = all(numerical_gates.values())

    is_hash = lambda value: isinstance(value, str) and len(value) == 64 and all(
        character in "0123456789abcdef" for character in value
    )
    evidence_gates = {
        "operator_supplied_origin": evidence.get("evidence_origin") == "operator_supplied",
        "approved_outcome_type": evidence.get("outcome_type")
        in {"technical_study", "capacity_statement", "connection_offer"},
        "independent_reference": evidence.get("independently_derived_reference") is True,
        "operator_approved": evidence.get("operator_approved") is True,
        "permission_to_use": evidence.get("permission_to_use") is True,
        "prediction_hash": is_hash(evidence.get("prediction_results_sha256"))
        and evidence.get("prediction_results_sha256") == _sha256(predictions),
        "operator_reference_hash": is_hash(evidence.get("operator_reference_sha256"))
        and evidence.get("operator_reference_sha256") == _sha256(references),
        "trusted_authority_signature": _trusted_signature_valid(
            evidence, trusted_public_key_path
        ),
    }
    operator_passed = numerical_passed and all(evidence_gates.values())
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Backtest calculated N-0 and firm capacity against approved outcomes",
        "mode": "synthetic_rehearsal" if fixture_mode else "supplied_outcomes",
        "validation_class": (
            "operator_reviewed"
            if operator_passed
            else "synthetic_demonstration"
            if fixture_mode
            else "operator_model_reconciled"
        ),
        "capacity_claim": False,
        "display_as_capacity": False,
        "numerical_outcome_backtest_passed": numerical_passed,
        "operator_outcome_validation_passed": operator_passed,
        "benchmark_execution_passed": numerical_passed if fixture_mode else operator_passed,
        "metrics": {
            "reference_case_count": len(references),
            "matched_case_count": len(matched),
            "coverage": round(coverage, 6),
            "binding_constraint_accuracy": round(constraint_accuracy, 6),
            "unsafe_cases": sorted(unsafe_keys),
            **metric_results,
        },
        "thresholds": {
            "minimum_cases": minimum_cases,
            "minimum_coverage": minimum_coverage,
            "capacity_mae_limit_mw": capacity_mae_limit_mw,
            "capacity_p95_limit_mw": capacity_p95_limit_mw,
            "unsafe_overstatement_tolerance_mw": unsafe_overstatement_tolerance_mw,
            "maximum_unsafe_overstatement_rate": 0.0,
            "minimum_constraint_accuracy": minimum_constraint_accuracy,
        },
        "numerical_gates": numerical_gates,
        "evidence_gates": evidence_gates,
        "evidence": evidence,
        "input_sha256": {
            "predictions": _sha256(predictions),
            "references": _sha256(references),
            "evidence": _sha256(evidence),
        },
        "limitations": [
            "Synthetic outcomes are a software rehearsal, not measured or operator-approved capacity.",
            "Operator-reviewed outcome agreement is not a connection offer or capacity reservation.",
            "Prospective validation on unseen sites is required before general performance claims.",
        ],
    }
    artifact["benchmark_sha256"] = _sha256(
        {key: value for key, value in artifact.items() if key != "generated_at"}
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
