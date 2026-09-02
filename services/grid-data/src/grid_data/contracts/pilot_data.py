"""Strict P0 contracts shared by synthetic and operator pilot providers."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Literal

from grid_data.network_study import NetworkModelInput, ValidationClass

EvidenceClass = Literal[
    "official_public", "open_mapping", "customer_supplied", "operator_supplied", "synthetic"
]
EvidenceOrigin = Literal[
    "official_open",
    "open_benchmark",
    "operator_supplied",
    "customer_declared",
    "synthetic_fixture",
    "derived",
]

_CANONICAL_ORIGIN: dict[str, EvidenceOrigin] = {
    "official_public": "official_open",
    "open_mapping": "official_open",
    "customer_supplied": "customer_declared",
    "operator_supplied": "operator_supplied",
    "synthetic": "synthetic_fixture",
}


def canonical_evidence_origin(evidence_class: EvidenceClass) -> EvidenceOrigin:
    """Translate the legacy ingestion vocabulary into the product-wide origin contract."""
    return _CANONICAL_ORIGIN[evidence_class]


def _sha256(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


@dataclass(frozen=True)
class ProvenanceRecord:
    evidence_class: EvidenceClass
    validation_class: ValidationClass
    is_synthetic: bool
    source_id: str
    source_url: str | None
    source_published_at: str | None
    model_version: str
    replacement_contract: str
    license: str
    artifact_sha256: str | None = None

    @property
    def evidence_origin(self) -> EvidenceOrigin:
        return canonical_evidence_origin(self.evidence_class)

    def validate(self) -> None:
        if not self.source_id or not self.model_version or not self.replacement_contract:
            raise ValueError(
                "Pilot provenance requires source, model version, and replacement contract."
            )
        if not self.license:
            raise ValueError("Pilot provenance requires an explicit licence or data-use basis.")
        if self.is_synthetic != (self.evidence_class == "synthetic"):
            raise ValueError("Synthetic provenance flags are inconsistent.")
        if self.is_synthetic and self.validation_class != "synthetic_demonstration":
            raise ValueError("Synthetic data cannot be promoted beyond synthetic_demonstration.")
        if (
            not self.is_synthetic
            and self.evidence_class == "operator_supplied"
            and not self.source_url
        ):
            raise ValueError("Operator data requires a controlled source reference.")
        if self.artifact_sha256 and (
            len(self.artifact_sha256) != 64
            or any(character not in "0123456789abcdef" for character in self.artifact_sha256)
        ):
            raise ValueError("artifact_sha256 must be a lowercase SHA-256 digest.")

    def network_provenance(self) -> dict[str, Any]:
        self.validate()
        return {
            **asdict(self),
            "evidence_origin": self.evidence_origin,
            "source_url": self.source_url or f"synthetic://{self.source_id}",
        }


@dataclass(frozen=True)
class PilotDatasetManifest:
    dataset_id: str
    dataset_version: str
    title: str
    geographic_scope: str
    provenance: ProvenanceRecord
    file_hashes: dict[str, str]
    created_at: str
    warning: str

    def validate(self) -> None:
        self.provenance.validate()
        if not self.dataset_id or not self.dataset_version or not self.file_hashes:
            raise ValueError("Pilot manifest is incomplete.")
        datetime.fromisoformat(self.created_at.replace("Z", "+00:00"))
        if self.provenance.is_synthetic and "synthetic" not in self.warning.lower():
            raise ValueError("Synthetic pilot manifests require an explicit warning.")
        for name, digest in self.file_hashes.items():
            if not name or len(digest) != 64:
                raise ValueError("Every pilot artifact requires a SHA-256 digest.")


@dataclass(frozen=True)
class OperatingObservation:
    timestamp: str
    element_id: str
    active_power_mw: float
    reactive_power_mvar: float | None = None
    voltage_pu: float | None = None
    loading_percent: float | None = None
    quality: Literal["good", "substituted", "bad", "missing"] = "good"


@dataclass(frozen=True)
class ConnectionQueueEntry:
    project_id: str
    candidate_bus: str
    import_mw: float
    export_mw: float
    status: Literal["requested", "accepted", "withdrawn", "rejected", "accepted_mock"]
    earliest_energisation: str | None
    inclusion_probability: float
    is_synthetic: bool

    def validate(self) -> None:
        if self.import_mw < 0 or self.export_mw < 0 or not 0 <= self.inclusion_probability <= 1:
            raise ValueError("Queue powers must be non-negative and probability must be in [0,1].")
        if self.is_synthetic != (self.status == "accepted_mock"):
            raise ValueError("Synthetic queue entries must use accepted_mock status.")


@dataclass(frozen=True)
class ReinforcementDefinition:
    reinforcement_id: str
    affected_element_ids: tuple[str, ...]
    action: Literal["replace", "add", "uprate"]
    earliest_commissioning: str
    latest_commissioning: str
    parameter_changes: dict[str, Any]
    is_synthetic: bool


@dataclass(frozen=True)
class ContingencyDefinition:
    contingency_id: str
    element_type: Literal["line", "transformer"]
    element_id: str
    mandatory: bool
    reviewed_by_operator: bool
    is_synthetic: bool


@dataclass(frozen=True)
class SwitchingStateDefinition:
    state_id: str
    switch_positions: dict[str, bool]
    is_synthetic: bool


@dataclass(frozen=True)
class PlannedOutageDefinition:
    outage_id: str
    element_type: Literal["line", "transformer", "switch"]
    element_id: str
    starts_at: str
    ends_at: str
    reason: str
    is_synthetic: bool

    def validate(self) -> None:
        if datetime.fromisoformat(self.ends_at.replace("Z", "+00:00")) <= datetime.fromisoformat(
            self.starts_at.replace("Z", "+00:00")
        ):
            raise ValueError("Planned outage end must be after its start.")


@dataclass(frozen=True)
class CustomerProfileDefinition:
    profile_id: str
    project_type: Literal["data_centre", "bess", "electrolyser", "industrial_load"]
    peak_import_mw: float
    peak_export_mw: float
    critical_load_mw: float
    profile_generator: str
    is_synthetic: bool


@dataclass(frozen=True)
class FlexibilityAssetDefinition:
    asset_id: str
    asset_type: Literal["battery", "flexible_load", "onsite_generation"]
    power_mw: float
    energy_mwh: float | None
    availability: float
    is_synthetic: bool


@dataclass(frozen=True)
class SecurityCriteria:
    minimum_voltage_pu: float
    maximum_voltage_pu: float
    maximum_normal_loading_percent: float
    maximum_emergency_loading_percent: float
    require_n_minus_one: bool
    criteria_source: str
    is_synthetic: bool

    def validate(self) -> None:
        if not 0 < self.minimum_voltage_pu < self.maximum_voltage_pu:
            raise ValueError("Voltage criteria are invalid.")
        if self.maximum_normal_loading_percent <= 0:
            raise ValueError("Loading criteria must be positive.")


@dataclass(frozen=True)
class PilotDataBundle:
    manifest: PilotDatasetManifest
    network_model: NetworkModelInput
    observations: tuple[OperatingObservation, ...]
    queue: tuple[ConnectionQueueEntry, ...]
    reinforcements: tuple[ReinforcementDefinition, ...]
    contingencies: tuple[ContingencyDefinition, ...]
    switching_states: tuple[SwitchingStateDefinition, ...]
    planned_outages: tuple[PlannedOutageDefinition, ...]
    customer_profiles: tuple[CustomerProfileDefinition, ...]
    flexibility_assets: tuple[FlexibilityAssetDefinition, ...]
    security_criteria: SecurityCriteria
    metadata: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        self.manifest.validate()
        synthetic = self.manifest.provenance.is_synthetic
        if self.network_model.validation_class != self.manifest.provenance.validation_class:
            raise ValueError("Network and dataset validation classes must match.")
        if self.network_model.model_version != self.manifest.provenance.model_version:
            raise ValueError("Network and provenance model versions must match.")
        if not self.observations or not self.contingencies:
            raise ValueError("Pilot data requires observations and a contingency set.")
        if any(item.is_synthetic != synthetic for item in self.queue):
            raise ValueError("Queue evidence class does not match the pilot dataset.")
        if any(item.is_synthetic != synthetic for item in self.reinforcements):
            raise ValueError("Reinforcement evidence class does not match the pilot dataset.")
        if any(item.is_synthetic != synthetic for item in self.contingencies):
            raise ValueError("Contingency evidence class does not match the pilot dataset.")
        if any(item.is_synthetic != synthetic for item in self.switching_states):
            raise ValueError("Switching-state evidence class does not match the pilot dataset.")
        if any(item.is_synthetic != synthetic for item in self.planned_outages):
            raise ValueError("Planned-outage evidence class does not match the pilot dataset.")
        if any(item.is_synthetic != synthetic for item in self.customer_profiles):
            raise ValueError("Customer-profile evidence class does not match the pilot dataset.")
        if any(item.is_synthetic != synthetic for item in self.flexibility_assets):
            raise ValueError("Flexibility evidence class does not match the pilot dataset.")
        if not any(item.state_id == "normal" for item in self.switching_states):
            raise ValueError("Pilot data requires an explicit normal switching state.")
        if self.security_criteria.is_synthetic != synthetic:
            raise ValueError("Security criteria evidence class does not match the pilot dataset.")
        for item in self.queue:
            item.validate()
        for item in self.planned_outages:
            item.validate()
        self.security_criteria.validate()

    @property
    def dataset_hash(self) -> str:
        self.validate()
        return _sha256(
            {
                "manifest": asdict(self.manifest),
                "network_model": asdict(self.network_model),
                "observations": [asdict(item) for item in self.observations],
                "queue": [asdict(item) for item in self.queue],
                "reinforcements": [asdict(item) for item in self.reinforcements],
                "contingencies": [asdict(item) for item in self.contingencies],
                "switching_states": [asdict(item) for item in self.switching_states],
                "planned_outages": [asdict(item) for item in self.planned_outages],
                "customer_profiles": [asdict(item) for item in self.customer_profiles],
                "flexibility_assets": [asdict(item) for item in self.flexibility_assets],
                "security_criteria": asdict(self.security_criteria),
            }
        )
