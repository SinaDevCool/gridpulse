from __future__ import annotations

import itertools
from dataclasses import asdict, dataclass
from typing import Any

from grid_data.p0_foundation import ScenarioDefinition, canonical_hash


@dataclass(frozen=True)
class StateAxis:
    name: str
    values: tuple[Any, ...]


def generate_state_space(axes: list[StateAxis], *, maximum_states: int = 100_000) -> dict[str, Any]:
    if not axes or any(not axis.values for axis in axes):
        raise ValueError("Every state-space axis must contain at least one value.")
    if len({axis.name for axis in axes}) != len(axes):
        raise ValueError("State-space axis names must be unique.")
    theoretical = 1
    for axis in axes:
        theoretical *= len(axis.values)
    if theoretical > maximum_states:
        raise ValueError(
            f"State space contains {theoretical} permutations; limit is {maximum_states}."
        )
    states = []
    for values in itertools.product(*(axis.values for axis in axes)):
        payload = dict(zip((axis.name for axis in axes), values, strict=True))
        states.append({"state_id": canonical_hash(payload)[:20], "parameters": payload})
    return {
        "schema_version": "gridpulse-graph-state-space-v1",
        "axes": [asdict(axis) for axis in axes],
        "theoretical_count": theoretical,
        "generated_count": len(states),
        "states": states,
        "state_space_sha256": canonical_hash(states),
        "physics_verification_required": True,
        "display_as_capacity": False,
    }


def states_to_scenarios(state_space: dict[str, Any]) -> list[ScenarioDefinition]:
    allowed = set(ScenarioDefinition.__dataclass_fields__) - {"scenario_id"}
    scenarios = []
    for state in state_space["states"]:
        values = state["parameters"]
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"Unsupported scenario axes: {', '.join(sorted(unknown))}")
        scenarios.append(ScenarioDefinition(state["state_id"], **values))
    return scenarios
