"""Benchmark E: prospective, pre-registered capacity holdout validation."""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

from .benchmark_c import _trusted_signature_valid

SCHEMA_VERSION = "gridpulse-benchmark-e-v1"


def _sha256(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _parse_time(value: Any) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Benchmark E timestamps must include a timezone.")
    return parsed.astimezone(timezone.utc)


def _p95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def _wilson_upper(successes: int, total: int, z: float = 1.6448536269514722) -> float:
    """One-sided 95% Wilson upper confidence bound for a binomial rate."""
    if total <= 0:
        return 1.0
    rate = successes / total
    denominator = 1 + z * z / total
    centre = rate + z * z / (2 * total)
    margin = z * math.sqrt(rate * (1 - rate) / total + z * z / (4 * total * total))
    return (centre + margin) / denominator


def _fixture() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    predictions = []
    outcomes = []
    constraints = ("line_thermal_loading", "minimum_bus_voltage", "transformer_thermal_loading")
    seasons = ("winter", "spring", "summer", "autumn")
    errors = (-0.10, -0.05, 0.0, 0.05)
    for index in range(20):
        case_id = f"prospective-{index:02d}"
        site_id = f"synthetic-site-{index % 5 + 1}"
        reference = 3.0 + (index % 7) * 0.55
        predicted = reference + errors[index % len(errors)]
        constraint = constraints[index % len(constraints)]
        predictions.append(
            {
                "case_id": case_id,
                "site_id": site_id,
                "issued_at": "2026-01-01T00:00:00+00:00",
                "firm_import_mw": round(predicted, 3),
                "lower_bound_mw": round(predicted - 0.3, 3),
                "upper_bound_mw": round(predicted + 0.3, 3),
                "binding_constraint": constraint,
                "voltage_class": "HV" if index % 2 else "MV",
                "season": seasons[index % len(seasons)],
                "security_case": "N-1",
            }
        )
        outcomes.append(
            {
                "case_id": case_id,
                "site_id": site_id,
                "observed_at": "2026-02-01T00:00:00+00:00",
                "operator_firm_import_mw": round(reference, 3),
                "binding_constraint": constraint,
            }
        )
    evidence = {
        "evidence_origin": "synthetic_fixture",
        "prospective_protocol": False,
        "predictions_frozen_before_outcomes": True,
        "operator_approved": False,
        "permission_to_use": True,
        "preregistration_protocol_sha256": "0" * 64,
        "frozen_predictions_sha256": _sha256(predictions),
        "operator_outcomes_sha256": _sha256(outcomes),
        "label": "Synthetic prospective rehearsal — no operator performance claim",
    }
    return predictions, outcomes, evidence


def _load_rows(path: Path, label: str) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not payload or not all(isinstance(row, dict) for row in payload):
        raise ValueError(f"{label} must be a non-empty JSON array of objects.")
    return payload


def _validate_inputs(predictions: list[dict[str, Any]], outcomes: list[dict[str, Any]]) -> None:
    prediction_fields = {
        "case_id",
        "site_id",
        "issued_at",
        "firm_import_mw",
        "lower_bound_mw",
        "upper_bound_mw",
        "binding_constraint",
        "voltage_class",
        "season",
        "security_case",
    }
    outcome_fields = {
        "case_id",
        "site_id",
        "observed_at",
        "operator_firm_import_mw",
        "binding_constraint",
    }
    if any(not prediction_fields <= row.keys() for row in predictions):
        raise ValueError("Predictions are missing prospective holdout fields.")
    if any(not outcome_fields <= row.keys() for row in outcomes):
        raise ValueError("Outcomes are missing prospective holdout fields.")
    for rows, label in ((predictions, "Predictions"), (outcomes, "Outcomes")):
        keys = [(str(row["case_id"]), str(row["site_id"])) for row in rows]
        if len(keys) != len(set(keys)):
            raise ValueError(f"{label} contain duplicate case/site keys.")
    for row in predictions:
        firm = float(row["firm_import_mw"])
        lower = float(row["lower_bound_mw"])
        upper = float(row["upper_bound_mw"])
        if not all(math.isfinite(value) and value >= 0 for value in (firm, lower, upper)):
            raise ValueError("Prediction capacity values must be finite and non-negative.")
        if not lower <= firm <= upper:
            raise ValueError("Prediction interval must contain the point estimate.")
        _parse_time(row["issued_at"])
    for row in outcomes:
        value = float(row["operator_firm_import_mw"])
        if not math.isfinite(value) or value < 0:
            raise ValueError("Operator outcome capacity must be finite and non-negative.")
        _parse_time(row["observed_at"])


def build_benchmark_e_artifact(
    output: Path,
    *,
    predictions_path: Path | None = None,
    outcomes_path: Path | None = None,
    evidence_path: Path | None = None,
    trusted_public_key_path: Path | None = None,
    minimum_cases: int = 20,
    minimum_sites: int = 4,
    minimum_strata: int = 4,
    minimum_coverage: float = 0.95,
    capacity_mae_limit_mw: float = 0.25,
    capacity_p95_limit_mw: float = 0.5,
    unsafe_overstatement_tolerance_mw: float = 0.25,
    unsafe_rate_upper_limit: float = 0.15,
    minimum_interval_coverage: float = 0.90,
    minimum_constraint_accuracy: float = 0.95,
) -> dict[str, Any]:
    supplied = (predictions_path, outcomes_path, evidence_path)
    if any(supplied) and not all(supplied):
        raise ValueError("Prediction, outcome and evidence paths must be supplied together.")
    if minimum_cases <= 0 or minimum_sites <= 0 or minimum_strata <= 0:
        raise ValueError("Benchmark E sample thresholds must be positive.")
    fractions = (
        minimum_coverage,
        unsafe_rate_upper_limit,
        minimum_interval_coverage,
        minimum_constraint_accuracy,
    )
    if any(not 0 <= value <= 1 for value in fractions) or minimum_coverage == 0:
        raise ValueError("Benchmark E rate thresholds are invalid.")

    if all(supplied):
        predictions = _load_rows(predictions_path, "Predictions")  # type: ignore[arg-type]
        outcomes = _load_rows(outcomes_path, "Outcomes")  # type: ignore[arg-type]
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))  # type: ignore[union-attr]
        if not isinstance(evidence, dict):
            raise ValueError("Evidence manifest must be a JSON object.")
        fixture_mode = False
    else:
        predictions, outcomes, evidence = _fixture()
        fixture_mode = True
    _validate_inputs(predictions, outcomes)

    prediction_index = {
        (str(row["case_id"]), str(row["site_id"])): row for row in predictions
    }
    pairs = [
        (prediction_index.get((str(row["case_id"]), str(row["site_id"]))), row)
        for row in outcomes
    ]
    matched = [(prediction, outcome) for prediction, outcome in pairs if prediction is not None]
    coverage = len(matched) / len(outcomes)
    errors = [
        float(prediction["firm_import_mw"]) - float(outcome["operator_firm_import_mw"])
        for prediction, outcome in matched
    ]
    absolute = [abs(value) for value in errors]
    unsafe = [
        f"{prediction['case_id']}::{prediction['site_id']}"
        for prediction, outcome in matched
        if float(prediction["firm_import_mw"])
        - float(outcome["operator_firm_import_mw"])
        > unsafe_overstatement_tolerance_mw
    ]
    temporal_violations = [
        f"{prediction['case_id']}::{prediction['site_id']}"
        for prediction, outcome in matched
        if _parse_time(prediction["issued_at"]) >= _parse_time(outcome["observed_at"])
    ]
    interval_hits = sum(
        float(prediction["lower_bound_mw"])
        <= float(outcome["operator_firm_import_mw"])
        <= float(prediction["upper_bound_mw"])
        for prediction, outcome in matched
    )
    constraint_hits = sum(
        str(prediction["binding_constraint"]) == str(outcome["binding_constraint"])
        for prediction, outcome in matched
    )
    interval_coverage = interval_hits / len(matched) if matched else 0.0
    constraint_accuracy = constraint_hits / len(matched) if matched else 0.0
    unsafe_upper = _wilson_upper(len(unsafe), len(matched))
    sites = {str(prediction["site_id"]) for prediction, _ in matched}
    strata = {
        (
            str(prediction["voltage_class"]),
            str(prediction["season"]),
            str(prediction["security_case"]),
        )
        for prediction, _ in matched
    }
    mae = mean(absolute) if absolute else math.inf
    p95 = _p95(absolute) if absolute else math.inf
    numerical_gates = {
        "minimum_case_count": len(matched) >= minimum_cases,
        "minimum_site_count": len(sites) >= minimum_sites,
        "minimum_stratum_count": len(strata) >= minimum_strata,
        "outcome_coverage": coverage >= minimum_coverage,
        "prediction_precedes_outcome": not temporal_violations,
        "capacity_mae": mae <= capacity_mae_limit_mw,
        "capacity_p95": p95 <= capacity_p95_limit_mw,
        "zero_unsafe_overstatements": not unsafe,
        "unsafe_rate_confidence_bound": unsafe_upper <= unsafe_rate_upper_limit,
        "interval_calibration": interval_coverage >= minimum_interval_coverage,
        "binding_constraint_accuracy": constraint_accuracy >= minimum_constraint_accuracy,
    }
    numerical_passed = all(numerical_gates.values())
    is_hash = lambda value: isinstance(value, str) and len(value) == 64 and all(
        character in "0123456789abcdef" for character in value
    )
    evidence_gates = {
        "operator_supplied_origin": evidence.get("evidence_origin") == "operator_supplied",
        "prospective_protocol": evidence.get("prospective_protocol") is True,
        "predictions_frozen": evidence.get("predictions_frozen_before_outcomes") is True,
        "operator_approved": evidence.get("operator_approved") is True,
        "permission_to_use": evidence.get("permission_to_use") is True,
        "preregistration_hash": is_hash(evidence.get("preregistration_protocol_sha256")),
        "prediction_hash": evidence.get("frozen_predictions_sha256") == _sha256(predictions),
        "outcome_hash": evidence.get("operator_outcomes_sha256") == _sha256(outcomes),
        "trusted_authority_signature": _trusted_signature_valid(
            evidence, trusted_public_key_path
        ),
    }
    operator_passed = numerical_passed and all(evidence_gates.values())
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Prospective holdout validation of firm capacity safety and calibration",
        "mode": "synthetic_rehearsal" if fixture_mode else "prospective_operator_holdout",
        "validation_class": (
            "operator_reviewed"
            if operator_passed
            else "synthetic_demonstration"
            if fixture_mode
            else "operator_model_reconciled"
        ),
        "capacity_claim": False,
        "display_as_capacity": False,
        "prospective_numerical_validation_passed": numerical_passed,
        "operator_prospective_validation_passed": operator_passed,
        "benchmark_execution_passed": numerical_passed if fixture_mode else operator_passed,
        "metrics": {
            "case_count": len(matched),
            "site_count": len(sites),
            "stratum_count": len(strata),
            "coverage": round(coverage, 6),
            "capacity_mae_mw": round(mae, 6) if math.isfinite(mae) else None,
            "capacity_p95_error_mw": round(p95, 6) if math.isfinite(p95) else None,
            "capacity_bias_mw": round(mean(errors), 6) if errors else None,
            "unsafe_overstatement_count": len(unsafe),
            "unsafe_overstatement_rate": round(len(unsafe) / len(matched), 6)
            if matched
            else None,
            "unsafe_rate_one_sided_95_upper": round(unsafe_upper, 6),
            "prediction_interval_coverage": round(interval_coverage, 6),
            "binding_constraint_accuracy": round(constraint_accuracy, 6),
            "unsafe_cases": sorted(unsafe),
            "temporal_violations": sorted(temporal_violations),
        },
        "thresholds": {
            "minimum_cases": minimum_cases,
            "minimum_sites": minimum_sites,
            "minimum_strata": minimum_strata,
            "minimum_coverage": minimum_coverage,
            "capacity_mae_limit_mw": capacity_mae_limit_mw,
            "capacity_p95_limit_mw": capacity_p95_limit_mw,
            "unsafe_overstatement_tolerance_mw": unsafe_overstatement_tolerance_mw,
            "unsafe_rate_one_sided_95_upper_limit": unsafe_rate_upper_limit,
            "minimum_interval_coverage": minimum_interval_coverage,
            "minimum_constraint_accuracy": minimum_constraint_accuracy,
        },
        "numerical_gates": numerical_gates,
        "evidence_gates": evidence_gates,
        "evidence": evidence,
        "input_sha256": {
            "predictions": _sha256(predictions),
            "outcomes": _sha256(outcomes),
            "evidence": _sha256(evidence),
        },
        "limitations": [
            "Synthetic prospective fixtures do not establish real-world generalization.",
            "A passing pilot sample does not create a connection offer or capacity reservation.",
            "Performance claims require a pre-registered representative multi-operator study.",
        ],
    }
    artifact["benchmark_sha256"] = _sha256(
        {key: value for key, value in artifact.items() if key != "generated_at"}
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
