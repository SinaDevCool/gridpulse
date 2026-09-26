from __future__ import annotations

from typing import Any

from grid_data.p0_foundation import ScenarioDefinition, canonical_hash

from .contracts import GraphProjection


def build_contingency_plan(
    projection: GraphProjection,
    *,
    mandatory_contingency_ids: set[str],
    maximum_cases: int = 10_000,
    include_restoration_candidates: bool = True,
) -> dict[str, Any]:
    contingencies = sorted(
        node.external_id for node in projection.nodes if node.kind == "Contingency"
    )
    switches = sorted(node.external_id for node in projection.nodes if node.kind == "Switch")
    missing = mandatory_contingency_ids - set(contingencies)
    if missing:
        raise ValueError(f"Mandatory contingencies are absent: {', '.join(sorted(missing))}")
    rows = [ScenarioDefinition("normal", source_kind="deterministic")]
    for contingency_id in contingencies:
        rows.append(
            ScenarioDefinition(
                f"outage-{contingency_id}",
                switching_state="contingency",
                contingency_id=contingency_id,
                source_kind="stress",
                metadata={"mandatory": contingency_id in mandatory_contingency_ids},
            )
        )
        if include_restoration_candidates:
            rows.extend(
                ScenarioDefinition(
                    f"restore-{contingency_id}-{switch_id}",
                    switching_state=f"restoration:{switch_id}",
                    contingency_id=contingency_id,
                    source_kind="stress",
                    metadata={
                        "candidate_switch": switch_id,
                        "operator_approval_required": True,
                        "mandatory": contingency_id in mandatory_contingency_ids,
                    },
                )
                for switch_id in switches
            )
    if len(rows) > maximum_cases:
        raise ValueError(
            f"Contingency expansion contains {len(rows)} cases; limit is {maximum_cases}."
        )
    mandatory_scenarios = sorted(row.scenario_id for row in rows if row.metadata.get("mandatory"))
    return {
        "schema_version": "gridpulse-contingency-plan-v1",
        "scenarios": rows,
        "scenario_count": len(rows),
        "mandatory_scenario_ids": mandatory_scenarios,
        "plan_sha256": canonical_hash([row.input_hash for row in rows]),
        "restoration_is_advisory": True,
        "operator_switching_approval_required": True,
        "physics_verification_required": True,
        "capacity_claim": False,
    }
