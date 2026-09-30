from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from grid_data.p0_foundation import canonical_hash


@dataclass(frozen=True)
class WorkspacePolicy:
    workspace_id: str
    permitted_regions: tuple[str, ...]
    purposes: tuple[str, ...]
    retention_days: int
    allow_model_training: bool = False
    allow_raw_export: bool = False

    def validate(self) -> None:
        if not self.permitted_regions or not self.purposes:
            raise ValueError("Workspace policy requires regions and processing purposes.")
        if not 1 <= self.retention_days <= 3650:
            raise ValueError("Retention must be between 1 and 3650 days.")


def authorize_processing(
    policy: WorkspacePolicy, *, region: str, purpose: str, model_training: bool = False
) -> dict[str, Any]:
    policy.validate()
    checks = {
        "region_allowed": region in policy.permitted_regions,
        "purpose_allowed": purpose in policy.purposes,
        "training_allowed": not model_training or policy.allow_model_training,
    }
    payload = {
        "policy": asdict(policy),
        "request": {"region": region, "purpose": purpose, "model_training": model_training},
        "checks": checks,
        "authorized": all(checks.values()),
    }
    return {**payload, "authorization_sha256": canonical_hash(payload)}


def redact_export(payload: dict[str, Any], policy: WorkspacePolicy) -> dict[str, Any]:
    policy.validate()
    if policy.allow_raw_export:
        return {"payload": payload, "redacted": False, "export_sha256": canonical_hash(payload)}
    protected = {
        "buses",
        "branches",
        "transformers",
        "switches",
        "scada",
        "observations",
        "properties_json",
    }
    redacted = {key: value for key, value in payload.items() if key not in protected}
    return {
        "payload": redacted,
        "redacted": True,
        "removed_fields": sorted(set(payload) & protected),
        "export_sha256": canonical_hash(redacted),
    }
