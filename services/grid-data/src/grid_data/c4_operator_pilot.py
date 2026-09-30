"""Release C4 operator-pilot ingestion and reconciliation primitives."""

from __future__ import annotations

import csv
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any


@dataclass(frozen=True)
class ScadaObservation:
    timestamp: str
    element_id: str
    active_power_mw: float
    reactive_power_mvar: float | None
    voltage_pu: float | None
    loading_percent: float | None
    quality: str


ALLOWED_QUALITY = {"good", "suspect", "bad", "substituted"}


def inspect_operator_package(paths: list[Path], *, package_type: str) -> dict[str, Any]:
    if package_type not in {
        "cgmes",
        "scada",
        "ratings",
        "contingencies",
        "agreement",
        "switching_state",
        "planned_outages",
        "connection_queue",
        "reinforcements",
        "protection",
    }:
        raise ValueError("Unsupported operator package type.")
    if not paths:
        raise ValueError("At least one package file is required.")
    digest = hashlib.sha256()
    files = []
    for path in sorted(paths, key=lambda value: value.name):
        if not path.is_file():
            raise ValueError(f"Package file does not exist: {path}")
        content = path.read_bytes()
        digest.update(path.name.encode())
        digest.update(content)
        files.append(
            {
                "name": path.name,
                "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )
    return {
        "schema_version": "gridpulse-c4-package-manifest-v1",
        "package_type": package_type,
        "package_sha256": digest.hexdigest(),
        "files": files,
        "validation_class": "operator_model_unvalidated",
        "inspected_at": datetime.now(timezone.utc).isoformat(),
    }


def parse_scada_csv(
    path: Path, *, maximum_bad_fraction: float = 0.05
) -> tuple[list[ScadaObservation], dict[str, Any]]:
    required = {"timestamp", "element_id", "active_power_mw", "quality"}
    observations: list[ScadaObservation] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"SCADA CSV requires columns: {', '.join(sorted(required))}")
        for row_number, row in enumerate(reader, start=2):
            quality = str(row["quality"]).strip().lower()
            if quality not in ALLOWED_QUALITY:
                raise ValueError(f"Row {row_number} has unsupported quality flag.")
            try:
                timestamp = datetime.fromisoformat(str(row["timestamp"]).replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    raise ValueError
                active = float(row["active_power_mw"])
            except (TypeError, ValueError) as error:
                raise ValueError(
                    f"Row {row_number} has invalid timestamp or active power."
                ) from error
            optional = {}
            for key in ("reactive_power_mvar", "voltage_pu", "loading_percent"):
                value = str(row.get(key) or "").strip()
                optional[key] = float(value) if value else None
            if optional["voltage_pu"] is not None and not 0.5 <= optional["voltage_pu"] <= 1.5:
                raise ValueError(f"Row {row_number} voltage is outside the ingestion sanity range.")
            observations.append(
                ScadaObservation(
                    timestamp=timestamp.astimezone(timezone.utc).isoformat(),
                    element_id=str(row["element_id"]).strip(),
                    active_power_mw=active,
                    quality=quality,
                    **optional,
                )
            )
    if not observations:
        raise ValueError("SCADA file has no observations.")
    duplicate_keys = len(observations) - len(
        {(item.timestamp, item.element_id) for item in observations}
    )
    bad = sum(item.quality == "bad" for item in observations)
    bad_fraction = bad / len(observations)
    if duplicate_keys:
        raise ValueError(f"SCADA file contains {duplicate_keys} duplicate timestamp/element rows.")
    if bad_fraction > maximum_bad_fraction:
        raise ValueError("SCADA bad-quality fraction exceeds the acceptance threshold.")
    manifest = inspect_operator_package([path], package_type="scada")
    manifest["quality"] = {
        "observation_count": len(observations),
        "element_count": len({item.element_id for item in observations}),
        "start": min(item.timestamp for item in observations),
        "end": max(item.timestamp for item in observations),
        "bad_fraction": bad_fraction,
        "accepted_for_reconciliation": True,
    }
    return observations, manifest


def reconcile_measurements(
    observed: list[ScadaObservation],
    simulated: list[dict[str, Any]],
    *,
    active_power_mae_limit_mw: float,
    voltage_mae_limit_pu: float = 0.02,
    reactive_power_mae_limit_mvar: float | None = None,
    loading_mae_limit_percent: float | None = None,
    minimum_coverage: float = 0.95,
) -> dict[str, Any]:
    simulated_index = {(str(row["timestamp"]), str(row["element_id"])): row for row in simulated}
    usable = [item for item in observed if item.quality in {"good", "substituted"}]
    pairs = [(item, simulated_index.get((item.timestamp, item.element_id))) for item in usable]
    matched = [(item, row) for item, row in pairs if row is not None]
    coverage = len(matched) / len(usable) if usable else 0
    active_errors = [
        abs(item.active_power_mw - float(row["active_power_mw"])) for item, row in matched
    ]
    voltage_errors = [
        abs(float(item.voltage_pu) - float(row["voltage_pu"]))
        for item, row in matched
        if item.voltage_pu is not None and row.get("voltage_pu") is not None
    ]
    reactive_errors = [
        abs(float(item.reactive_power_mvar) - float(row["reactive_power_mvar"]))
        for item, row in matched
        if item.reactive_power_mvar is not None and row.get("reactive_power_mvar") is not None
    ]
    loading_errors = [
        abs(float(item.loading_percent) - float(row["loading_percent"]))
        for item, row in matched
        if item.loading_percent is not None and row.get("loading_percent") is not None
    ]
    active_mae = mean(active_errors) if active_errors else math.inf
    active_rmse = (
        math.sqrt(mean([value * value for value in active_errors])) if active_errors else math.inf
    )
    voltage_mae = mean(voltage_errors) if voltage_errors else None
    reactive_mae = mean(reactive_errors) if reactive_errors else None
    loading_mae = mean(loading_errors) if loading_errors else None
    passes = (
        coverage >= minimum_coverage
        and active_mae <= active_power_mae_limit_mw
        and (voltage_mae is None or voltage_mae <= voltage_mae_limit_pu)
        and (
            reactive_power_mae_limit_mvar is None
            or reactive_mae is None
            or reactive_mae <= reactive_power_mae_limit_mvar
        )
        and (
            loading_mae_limit_percent is None
            or loading_mae is None
            or loading_mae <= loading_mae_limit_percent
        )
    )
    payload = {
        "schema_version": "gridpulse-c4-reconciliation-v1",
        "status": "passed" if passes else "failed",
        "promotion_allowed": passes,
        "metrics": {
            "usable_observations": len(usable),
            "matched_observations": len(matched),
            "coverage": round(coverage, 6),
            "active_power_mae_mw": round(active_mae, 6) if math.isfinite(active_mae) else None,
            "active_power_rmse_mw": round(active_rmse, 6) if math.isfinite(active_rmse) else None,
            "voltage_mae_pu": round(voltage_mae, 6) if voltage_mae is not None else None,
            "reactive_power_mae_mvar": round(reactive_mae, 6) if reactive_mae is not None else None,
            "loading_mae_percent": round(loading_mae, 6) if loading_mae is not None else None,
            "missing_data_rate": round(1 - coverage, 6),
        },
        "thresholds": {
            "minimum_coverage": minimum_coverage,
            "active_power_mae_limit_mw": active_power_mae_limit_mw,
            "voltage_mae_limit_pu": voltage_mae_limit_pu,
            "reactive_power_mae_limit_mvar": reactive_power_mae_limit_mvar,
            "loading_mae_limit_percent": loading_mae_limit_percent,
        },
        "limitations": [
            "Passing reconciliation supports operator_model_reconciled only; it is not operator approval.",
            "Protection, fault level and dynamic behaviour require separate studies.",
        ],
    }
    payload["result_sha256"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode()
    ).hexdigest()
    return payload


def build_pilot_readiness(
    manifests: list[dict[str, Any]],
    reconciliation: dict[str, Any] | None,
    agreement: dict[str, Any] | None,
) -> dict[str, Any]:
    package_types = {item.get("package_type") for item in manifests}
    gates = {
        "cgmes_package_validated": "cgmes" in package_types,
        "scada_package_validated": "scada" in package_types,
        "ratings_supplied": "ratings" in package_types,
        "contingency_list_supplied": "contingencies" in package_types,
        "reconciliation_passed": bool(reconciliation and reconciliation.get("promotion_allowed")),
        "written_data_use_agreement_recorded": bool(
            agreement and agreement.get("status") == "signed" and agreement.get("document_sha256")
        ),
        "capacity_representation_permission_recorded": bool(
            agreement and agreement.get("capacity_representation_allowed") is True
        ),
        "operator_approval_recorded": bool(
            agreement and agreement.get("operator_approval_status") == "approved"
        ),
    }
    return {
        "schema_version": "gridpulse-c4-pilot-readiness-v1",
        "gates": gates,
        "ready_for_operator_review": all(list(gates.values())[:5]),
        "operator_confirmed": all(gates.values()),
        "validation_class": (
            "operator_confirmed"
            if all(gates.values())
            else "operator_model_reconciled"
            if gates["reconciliation_passed"]
            else "operator_model_unvalidated"
        ),
        "missing": [key for key, value in gates.items() if not value],
    }
