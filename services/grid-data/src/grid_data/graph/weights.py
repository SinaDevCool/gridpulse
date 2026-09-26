from __future__ import annotations

from dataclasses import dataclass

WEIGHT_MODEL_VERSION = "topology-investigation-cost-v1"


@dataclass(frozen=True)
class WeightInputs:
    distance_km: float = 0
    voltage_transitions: int = 0
    missing_parameter_ratio: float = 0
    evidence_gap_ratio: float = 0
    radial_or_bridge: bool = False
    operator_boundary: bool = False
    planning_constraint: bool = False


def topology_weight(value: WeightInputs) -> dict[str, object]:
    components = {
        "distance": min(max(value.distance_km / 20, 0), 1) * 0.30,
        "voltage_transitions": min(value.voltage_transitions / 3, 1) * 0.15,
        "missing_parameters": min(max(value.missing_parameter_ratio, 0), 1) * 0.15,
        "evidence_gap": min(max(value.evidence_gap_ratio, 0), 1) * 0.15,
        "radial_or_bridge": (1 if value.radial_or_bridge else 0) * 0.10,
        "operator_boundary": (1 if value.operator_boundary else 0) * 0.10,
        "planning_constraint": (1 if value.planning_constraint else 0) * 0.05,
    }
    return {
        "version": WEIGHT_MODEL_VERSION,
        "total": round(sum(components.values()), 6),
        "components": components,
        "meaning": "relative investigation cost",
        "prohibited_interpretations": [
            "available capacity",
            "connection probability",
            "delivery date",
        ],
    }
