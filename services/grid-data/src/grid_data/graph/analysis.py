from __future__ import annotations

import heapq
from collections import defaultdict
from typing import Any

from .contracts import GraphProjection


def _bus_graph(projection: GraphProjection):
    terminals: dict[str, list[str]] = defaultdict(list)
    node_kind = {item.external_id: item.kind for item in projection.nodes}
    node_props = {item.external_id: item.properties for item in projection.nodes}
    for edge in projection.edges:
        if edge.kind == "TERMINAL_AT":
            terminals[edge.source].append(edge.target)
    adjacency: dict[str, list[tuple[str, str, float]]] = defaultdict(list)
    for asset, buses in terminals.items():
        if node_kind.get(asset) not in {"Line", "Transformer"} or len(buses) != 2:
            continue
        props = node_props[asset]
        weight = max(float(props.get("length_km", 0.25)), 0.001)
        if node_kind[asset] == "Transformer":
            weight += 2.0
        adjacency[buses[0]].append((buses[1], asset, weight))
        adjacency[buses[1]].append((buses[0], asset, weight))
    return adjacency, terminals, node_kind, node_props


def analyze_topology(projection: GraphProjection) -> dict[str, Any]:
    adjacency, terminals, kinds, props = _bus_graph(projection)
    buses = sorted(key for key, value in kinds.items() if value == "Bus")
    orphan_buses = [bus for bus in buses if not adjacency.get(bus)]
    malformed = sorted(
        asset
        for asset, ends in terminals.items()
        if kinds.get(asset) in {"Line", "Transformer"} and len(ends) != 2
    )
    missing_parameters = []
    for asset, kind in kinds.items():
        required = (
            {"r_ohm_per_km", "x_ohm_per_km", "max_i_ka"}
            if kind == "Line"
            else {"sn_mva", "vk_percent", "vkr_percent"}
            if kind == "Transformer"
            else set()
        )
        if required - props.get(asset, {}).keys():
            missing_parameters.append(asset)
    components, seen = [], set()
    for root in buses:
        if root in seen:
            continue
        stack, component = [root], []
        while stack:
            node = stack.pop()
            if node in seen:
                continue
            seen.add(node)
            component.append(node)
            stack.extend(item[0] for item in adjacency.get(node, []))
        components.append(sorted(component))
    bridges, articulation = _criticality(adjacency)
    accepted = not malformed and not missing_parameters and len(components) == 1
    return {
        "schema_version": "gridpulse-graph-audit-v1",
        "model_id": projection.model_id,
        "model_version": projection.model_version,
        "projection_sha256": projection.projection_sha256,
        "connected_components": components,
        "orphan_buses": orphan_buses,
        "malformed_equipment": malformed,
        "missing_parameters": sorted(missing_parameters),
        "bridge_assets": sorted(bridges),
        "articulation_buses": sorted(articulation),
        "accepted_for_pathfinding": not malformed,
        "accepted_for_physics": accepted,
        **projection.safety,
    }


def _criticality(adjacency):
    timer, visited, tin, low, bridges, cuts = 0, set(), {}, {}, set(), set()

    def dfs(node, parent=None):
        nonlocal timer
        visited.add(node)
        tin[node] = low[node] = timer
        timer += 1
        children = 0
        for nxt, asset, _ in adjacency.get(node, []):
            if nxt == parent:
                continue
            if nxt in visited:
                low[node] = min(low[node], tin[nxt])
                continue
            dfs(nxt, node)
            low[node] = min(low[node], low[nxt])
            children += 1
            if low[nxt] > tin[node]:
                bridges.add(asset)
            if parent is not None and low[nxt] >= tin[node]:
                cuts.add(node)
        if parent is None and children > 1:
            cuts.add(node)

    for node in adjacency:
        if node not in visited:
            dfs(node)
    return bridges, cuts


def candidate_pathways(
    projection: GraphProjection, source_bus: str, target_buses: list[str], *, k: int = 3
) -> dict[str, Any]:
    adjacency, *_ = _bus_graph(projection)
    if source_bus not in adjacency:
        raise ValueError("Candidate bus is absent or disconnected in the selected model version.")
    found = []
    queue = [(0.0, source_bus, (source_bus,), ())]
    while queue and len(found) < k:
        cost, node, buses, assets = heapq.heappop(queue)
        if node in target_buses and node != source_bus:
            found.append(
                {
                    "rank": len(found) + 1,
                    "target_bus": node,
                    "bus_ids": list(buses),
                    "asset_ids": list(assets),
                    "total_graph_cost": round(cost, 6),
                }
            )
            continue
        for nxt, asset, weight in adjacency.get(node, []):
            if nxt not in buses:
                heapq.heappush(queue, (cost + weight, nxt, buses + (nxt,), assets + (asset,)))
    return {
        "schema_version": "gridpulse-topology-pathways-v1",
        "model_version": projection.model_version,
        "source_bus": source_bus,
        "pathways": found,
        "algorithm": "deterministic_k_simple_paths",
        **projection.safety,
    }


def shared_upstream_assets(
    projection: GraphProjection, candidate_buses: list[str], target_buses: list[str]
) -> dict[str, Any]:
    pathways = {
        bus: candidate_pathways(projection, bus, target_buses, k=1)["pathways"]
        for bus in candidate_buses
    }
    owners: dict[str, list[str]] = defaultdict(list)
    for bus, rows in pathways.items():
        if rows:
            for asset in rows[0]["asset_ids"]:
                owners[asset].append(bus)
    shared = [
        {"asset_id": asset, "candidate_buses": sorted(buses)}
        for asset, buses in owners.items()
        if len(buses) > 1
    ]
    return {
        "shared_assets": sorted(shared, key=lambda row: row["asset_id"]),
        "display_as_capacity": False,
        "capacity_claim": False,
    }
