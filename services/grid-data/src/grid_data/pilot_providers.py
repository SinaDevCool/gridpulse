"""Replaceable P0 pilot providers for synthetic fixtures and controlled operator packages."""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import fields
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Protocol

from .contracts import (
    ConnectionQueueEntry,
    ContingencyDefinition,
    CustomerProfileDefinition,
    FlexibilityAssetDefinition,
    OperatingObservation,
    PilotDataBundle,
    PilotDatasetManifest,
    PlannedOutageDefinition,
    ProvenanceRecord,
    ReinforcementDefinition,
    SecurityCriteria,
    SwitchingStateDefinition,
)
from .network_study import NetworkModelInput


class PilotDataProvider(Protocol):
    def load(self) -> PilotDataBundle: ...


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _strict_dataclass(cls, value: dict[str, Any]):
    known = {item.name for item in fields(cls)}
    unknown = set(value) - known
    if unknown:
        raise ValueError(f"Unknown {cls.__name__} fields: {', '.join(sorted(unknown))}")
    return cls(**value)


class DirectoryPilotDataProvider:
    """Load a canonical package and verify every declared file before parsing it."""

    expected_synthetic: bool | None = None

    def __init__(self, package_dir: str | Path) -> None:
        self.package_dir = Path(package_dir)

    def _manifest(self) -> PilotDatasetManifest:
        raw = _read_json(self.package_dir / "manifest.json")
        provenance = _strict_dataclass(ProvenanceRecord, raw.pop("provenance"))
        manifest = _strict_dataclass(PilotDatasetManifest, {**raw, "provenance": provenance})
        manifest.validate()
        for filename, expected in manifest.file_hashes.items():
            path = self.package_dir / filename
            if not path.is_file() or _digest(path) != expected:
                raise ValueError(f"Pilot artifact failed checksum validation: {filename}")
        if (
            self.expected_synthetic is not None
            and provenance.is_synthetic != self.expected_synthetic
        ):
            raise ValueError("Pilot provider received the wrong evidence class.")
        return manifest

    def _observations(
        self, value: dict[str, Any], synthetic: bool
    ) -> tuple[OperatingObservation, ...]:
        if value.get("generator") != "deterministic_hourly_v1":
            return tuple(_strict_dataclass(OperatingObservation, item) for item in value["rows"])
        start = datetime.fromisoformat(value["start"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(value["end_exclusive"].replace("Z", "+00:00"))
        hours = int((end - start).total_seconds() // 3600)
        if hours <= 0 or start + timedelta(hours=hours) != end:
            raise ValueError("Synthetic observation interval must contain complete UTC hours.")
        result = []
        for hour in range(hours):
            timestamp = start + timedelta(hours=hour)
            daily = math.sin(2 * math.pi * (hour % 24) / 24)
            seasonal = math.cos(2 * math.pi * hour / 8760)
            active = float(value["base_active_power_mw"]) * (1 + 0.12 * daily + 0.16 * seasonal)
            result.append(
                OperatingObservation(
                    timestamp=timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                    element_id=str(value["element_id"]),
                    active_power_mw=round(active, 5),
                    reactive_power_mvar=round(active * float(value["reactive_ratio"]), 5),
                    voltage_pu=round(1.0 - active * float(value["voltage_drop_per_mw"]), 6),
                    loading_percent=round(active / float(value["rating_mw"]) * 100, 5),
                    quality="good",
                )
            )
        if not synthetic:
            raise ValueError(
                "Generated observations are permitted only in synthetic pilot packages."
            )
        return tuple(result)

    def load(self) -> PilotDataBundle:
        manifest = self._manifest()
        synthetic = manifest.provenance.is_synthetic
        network = _read_json(self.package_dir / "network.json")
        model = NetworkModelInput(
            **network,
            provenance=manifest.provenance.network_provenance(),
            model_version=manifest.provenance.model_version,
            validation_class=manifest.provenance.validation_class,
        )
        bundle = PilotDataBundle(
            manifest=manifest,
            network_model=model,
            observations=self._observations(
                _read_json(self.package_dir / "observations.json"), synthetic
            ),
            queue=tuple(
                _strict_dataclass(ConnectionQueueEntry, item)
                for item in _read_json(self.package_dir / "queue.json")
            ),
            reinforcements=tuple(
                _strict_dataclass(
                    ReinforcementDefinition,
                    {**item, "affected_element_ids": tuple(item["affected_element_ids"])},
                )
                for item in _read_json(self.package_dir / "reinforcements.json")
            ),
            contingencies=tuple(
                _strict_dataclass(ContingencyDefinition, item)
                for item in _read_json(self.package_dir / "contingencies.json")
            ),
            switching_states=tuple(
                _strict_dataclass(SwitchingStateDefinition, item)
                for item in _read_json(self.package_dir / "switching-states.json")
            ),
            planned_outages=tuple(
                _strict_dataclass(PlannedOutageDefinition, item)
                for item in _read_json(self.package_dir / "planned-outages.json")
            ),
            customer_profiles=tuple(
                _strict_dataclass(CustomerProfileDefinition, item)
                for item in _read_json(self.package_dir / "customer-profiles.json")
            ),
            flexibility_assets=tuple(
                _strict_dataclass(FlexibilityAssetDefinition, item)
                for item in _read_json(self.package_dir / "flexibility-assets.json")
            ),
            security_criteria=_strict_dataclass(
                SecurityCriteria, _read_json(self.package_dir / "security-criteria.json")
            ),
            metadata={"provider": type(self).__name__, "replacement_ready": True},
        )
        bundle.validate()
        return bundle


class SyntheticPilotDataProvider(DirectoryPilotDataProvider):
    expected_synthetic = True


class OperatorPilotDataProvider(DirectoryPilotDataProvider):
    expected_synthetic = False

    def _manifest(self) -> PilotDatasetManifest:
        manifest = super()._manifest()
        if manifest.provenance.evidence_class != "operator_supplied":
            raise ValueError("Operator packages require operator_supplied provenance.")
        if manifest.provenance.validation_class not in {
            "operator_model_unvalidated",
            "operator_model_reconciled",
            "operator_reviewed",
            "operator_confirmed",
        }:
            raise ValueError("Operator packages require an operator validation class.")
        return manifest
