"""Benchmark C: fail-closed model-to-measurement reconciliation gate."""

from __future__ import annotations

import hashlib
import json
from base64 import b64decode
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .c4_operator_pilot import ScadaObservation, reconcile_measurements

SCHEMA_VERSION = "gridpulse-benchmark-c-v1"
REQUIRED_CHANNELS = (
    "active_power_mw",
    "reactive_power_mvar",
    "voltage_pu",
    "loading_percent",
)


def _canonical_sha256(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _synthetic_fixture() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    observed = []
    simulated = []
    for hour, active, voltage, loading in (
        (0, 8.0, 1.012, 44.0),
        (1, 9.5, 1.006, 51.0),
        (2, 11.0, 0.998, 59.0),
        (3, 12.5, 0.991, 67.0),
    ):
        timestamp = f"2026-01-15T{hour:02d}:00:00+00:00"
        observed.append(
            {
                "timestamp": timestamp,
                "element_id": "synthetic-feeder-01",
                "active_power_mw": active,
                "reactive_power_mvar": round(active * 0.25, 4),
                "voltage_pu": voltage,
                "loading_percent": loading,
                "quality": "good",
            }
        )
        simulated.append(
            {
                "timestamp": timestamp,
                "element_id": "synthetic-feeder-01",
                "active_power_mw": active + 0.08,
                "reactive_power_mvar": round(active * 0.25 + 0.03, 4),
                "voltage_pu": voltage - 0.001,
                "loading_percent": loading + 0.2,
            }
        )
    evidence = {
        "evidence_origin": "synthetic_fixture",
        "model_format": "synthetic_json",
        "independently_converted": False,
        "operator_authorized": False,
        "permission_to_use": True,
        "cgmes_package_sha256": None,
        "reference_results_sha256": _canonical_sha256(simulated),
        "label": "Synthetic reconciliation rehearsal — no operator or location claim",
    }
    return observed, simulated, evidence


def _load_rows(path: Path, label: str) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not payload or not all(isinstance(row, dict) for row in payload):
        raise ValueError(f"{label} must be a non-empty JSON array of objects.")
    return payload


def _observations(rows: list[dict[str, Any]]) -> list[ScadaObservation]:
    required = {"timestamp", "element_id", "active_power_mw", "quality"}
    if any(not required <= row.keys() for row in rows):
        raise ValueError("Observed rows are missing required reconciliation fields.")
    return [
        ScadaObservation(
            timestamp=str(row["timestamp"]),
            element_id=str(row["element_id"]),
            active_power_mw=float(row["active_power_mw"]),
            reactive_power_mvar=(
                float(row["reactive_power_mvar"])
                if row.get("reactive_power_mvar") is not None
                else None
            ),
            voltage_pu=float(row["voltage_pu"]) if row.get("voltage_pu") is not None else None,
            loading_percent=(
                float(row["loading_percent"])
                if row.get("loading_percent") is not None
                else None
            ),
            quality=str(row["quality"]),
        )
        for row in rows
    ]


def _channel_coverage(
    observed: list[ScadaObservation], simulated: list[dict[str, Any]]
) -> dict[str, float]:
    simulated_index = {
        (str(row.get("timestamp")), str(row.get("element_id"))): row for row in simulated
    }
    usable = [row for row in observed if row.quality in {"good", "substituted"}]
    coverage = {}
    for channel in REQUIRED_CHANNELS:
        matched = 0
        for row in usable:
            reference = simulated_index.get((row.timestamp, row.element_id))
            if getattr(row, channel) is not None and reference and reference.get(channel) is not None:
                matched += 1
        coverage[channel] = round(matched / len(usable), 6) if usable else 0.0
    return coverage


def _trusted_signature_valid(evidence: dict[str, Any], public_key_path: Path | None) -> bool:
    if public_key_path is None or not public_key_path.is_file():
        return False
    signature = evidence.get("signature_base64")
    if not isinstance(signature, str):
        return False
    signed_payload = {key: value for key, value in evidence.items() if key != "signature_base64"}
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_public_key

        public_key = load_pem_public_key(public_key_path.read_bytes())
        public_key.verify(
            b64decode(signature, validate=True),
            json.dumps(signed_payload, sort_keys=True, separators=(",", ":")).encode(),
        )
    except (ImportError, TypeError, ValueError):
        return False
    except Exception:  # noqa: BLE001 - invalid signatures have backend-specific exceptions
        return False
    return True


def build_benchmark_c_artifact(
    output: Path,
    *,
    observed_path: Path | None = None,
    simulated_path: Path | None = None,
    evidence_path: Path | None = None,
    trusted_public_key_path: Path | None = None,
    minimum_observations: int = 4,
    minimum_coverage: float = 0.95,
    active_power_mae_limit_mw: float = 0.5,
    reactive_power_mae_limit_mvar: float = 0.25,
    voltage_mae_limit_pu: float = 0.01,
    loading_mae_limit_percent: float = 1.0,
) -> dict[str, Any]:
    supplied = (observed_path, simulated_path, evidence_path)
    if any(supplied) and not all(supplied):
        raise ValueError("Observed, simulated and evidence paths must be supplied together.")
    if minimum_observations <= 0 or not 0 < minimum_coverage <= 1:
        raise ValueError("Benchmark C thresholds are invalid.")
    if any(
        value <= 0
        for value in (
            active_power_mae_limit_mw,
            reactive_power_mae_limit_mvar,
            voltage_mae_limit_pu,
            loading_mae_limit_percent,
        )
    ):
        raise ValueError("Benchmark C error limits must be positive.")

    if all(supplied):
        observed_rows = _load_rows(observed_path, "Observed input")  # type: ignore[arg-type]
        simulated_rows = _load_rows(simulated_path, "Simulated input")  # type: ignore[arg-type]
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))  # type: ignore[union-attr]
        if not isinstance(evidence, dict):
            raise ValueError("Evidence manifest must be a JSON object.")
        fixture_mode = False
    else:
        observed_rows, simulated_rows, evidence = _synthetic_fixture()
        fixture_mode = True

    observed = _observations(observed_rows)
    reconciliation = reconcile_measurements(
        observed,
        simulated_rows,
        active_power_mae_limit_mw=active_power_mae_limit_mw,
        reactive_power_mae_limit_mvar=reactive_power_mae_limit_mvar,
        voltage_mae_limit_pu=voltage_mae_limit_pu,
        loading_mae_limit_percent=loading_mae_limit_percent,
        minimum_coverage=minimum_coverage,
    )
    channel_coverage = _channel_coverage(observed, simulated_rows)
    numerical_gates = {
        "minimum_observation_count": len(observed) >= minimum_observations,
        "pair_coverage": reconciliation["metrics"]["coverage"] >= minimum_coverage,
        "active_power_error": (
            reconciliation["metrics"]["active_power_mae_mw"] is not None
            and reconciliation["metrics"]["active_power_mae_mw"]
            <= active_power_mae_limit_mw
        ),
        "reactive_power_error": (
            reconciliation["metrics"]["reactive_power_mae_mvar"] is not None
            and reconciliation["metrics"]["reactive_power_mae_mvar"]
            <= reactive_power_mae_limit_mvar
        ),
        "voltage_error": (
            reconciliation["metrics"]["voltage_mae_pu"] is not None
            and reconciliation["metrics"]["voltage_mae_pu"] <= voltage_mae_limit_pu
        ),
        "loading_error": (
            reconciliation["metrics"]["loading_mae_percent"] is not None
            and reconciliation["metrics"]["loading_mae_percent"]
            <= loading_mae_limit_percent
        ),
        "all_channel_coverage": all(
            value >= minimum_coverage for value in channel_coverage.values()
        ),
    }
    numerical_passed = all(numerical_gates.values())
    hash_pattern = lambda value: isinstance(value, str) and len(value) == 64 and all(
        character in "0123456789abcdef" for character in value
    )
    evidence_gates = {
        "operator_supplied_origin": evidence.get("evidence_origin") == "operator_supplied",
        "cgmes_model": evidence.get("model_format") in {"cgmes_2.4.15", "cgmes_3.0"},
        "independent_conversion": evidence.get("independently_converted") is True,
        "operator_authorized": evidence.get("operator_authorized") is True,
        "permission_to_use": evidence.get("permission_to_use") is True,
        "cgmes_hash": hash_pattern(evidence.get("cgmes_package_sha256")),
        "reference_results_hash": hash_pattern(evidence.get("reference_results_sha256")),
        "trusted_authority_signature": _trusted_signature_valid(
            evidence, trusted_public_key_path
        ),
    }
    operator_validation_passed = numerical_passed and all(evidence_gates.values())
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Model-to-operator-reference reconciliation and promotion gate",
        "mode": "synthetic_rehearsal" if fixture_mode else "supplied_evidence",
        "validation_class": (
            "operator_model_reconciled"
            if operator_validation_passed
            else "synthetic_demonstration"
            if fixture_mode
            else "operator_model_unvalidated"
        ),
        "capacity_claim": False,
        "display_as_capacity": False,
        "numerical_reconciliation_passed": numerical_passed,
        "operator_validation_passed": operator_validation_passed,
        "benchmark_execution_passed": numerical_passed if fixture_mode else operator_validation_passed,
        "numerical_gates": numerical_gates,
        "evidence_gates": evidence_gates,
        "channel_coverage": channel_coverage,
        "reconciliation": reconciliation,
        "evidence": evidence,
        "input_sha256": {
            "observed": _canonical_sha256(observed_rows),
            "simulated": _canonical_sha256(simulated_rows),
            "evidence": _canonical_sha256(evidence),
        },
        "limitations": [
            "Synthetic rehearsal passing does not reconcile or validate an operator model.",
            "Capacity publication still requires operator review and representation permission.",
            "Protection, short-circuit, harmonics and dynamics remain separate studies.",
        ],
    }
    artifact["benchmark_sha256"] = _canonical_sha256(
        {key: value for key, value in artifact.items() if key != "generated_at"}
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
