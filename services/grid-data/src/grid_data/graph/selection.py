from __future__ import annotations

from typing import Any

from grid_data.p0_foundation import ScenarioDefinition, canonical_hash


def select_graph_guided_scenarios(
    *,
    scenarios: list[ScenarioDefinition],
    mandatory_contingencies: set[str],
    relevant_assets: set[str],
    budget: int,
) -> dict[str, Any]:
    if budget < len(mandatory_contingencies):
        raise ValueError("Solver budget cannot exclude mandatory contingencies.")
    mandatory = [row for row in scenarios if row.contingency_id in mandatory_contingencies]
    missing = mandatory_contingencies - {row.contingency_id for row in mandatory}
    if missing:
        raise ValueError(f"Mandatory contingencies are absent: {', '.join(sorted(missing))}")
    relevant = [
        row
        for row in scenarios
        if row not in mandatory
        and (
            row.contingency_id in relevant_assets
            or bool(set(row.queue_project_ids) & relevant_assets)
            or bool(set(row.reinforcement_ids) & relevant_assets)
        )
    ]
    controls = [row for row in scenarios if row not in mandatory and row not in relevant]
    ordered = (
        mandatory
        + sorted(relevant, key=lambda row: row.input_hash)
        + sorted(controls, key=lambda row: row.input_hash)
    )
    selected = ordered[:budget]
    return {
        "schema_version": "gridpulse-graph-scenario-selection-v1",
        "selected_scenario_ids": [row.scenario_id for row in selected],
        "mandatory_included": sorted(mandatory_contingencies),
        "selected_count": len(selected),
        "candidate_count": len(scenarios),
        "reduction_fraction": round(1 - len(selected) / len(scenarios), 6),
        "selection_sha256": canonical_hash([row.input_hash for row in selected]),
        "physics_verification_required": True,
        "display_as_capacity": False,
        "capacity_claim": False,
    }
