from __future__ import annotations

from itertools import combinations
from typing import Any

from grid_data.p0_foundation import canonical_hash

from .analysis import candidate_pathways
from .contracts import GraphProjection


def analyze_portfolio_interactions(
    projection: GraphProjection, candidate_buses: list[str], target_buses: list[str]
) -> dict[str, Any]:
    if len(set(candidate_buses)) != len(candidate_buses):
        raise ValueError("Candidate buses must be unique.")
    paths = {
        bus: candidate_pathways(projection, bus, target_buses, k=1)["pathways"]
        for bus in candidate_buses
    }
    assets = {bus: set(rows[0]["asset_ids"]) if rows else set() for bus, rows in paths.items()}
    pairs = []
    for left, right in combinations(sorted(candidate_buses), 2):
        union = assets[left] | assets[right]
        shared = assets[left] & assets[right]
        pairs.append(
            {
                "candidate_a": left,
                "candidate_b": right,
                "shared_asset_ids": sorted(shared),
                "topology_overlap": round(len(shared) / len(union), 6) if union else 0,
                "path_diverse": bool(union) and not shared,
            }
        )
    payload = {"candidate_paths": paths, "pairwise_interactions": pairs}
    return {
        "schema_version": "gridpulse-portfolio-topology-v1",
        **payload,
        "portfolio_sha256": canonical_hash(payload),
        "interpretation": "shared topology exposure, not simultaneous connection capacity",
        "physics_verification_required": True,
        "capacity_claim": False,
    }
