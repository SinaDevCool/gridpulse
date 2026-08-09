from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

from grid_data.graph import (
    StateAxis,
    analyze_portfolio_interactions,
    analyze_topology,
    attach_physics_outcomes,
    build_projection,
    build_projection_delta,
    generate_state_space,
    validate_round_trip,
)
from grid_data.graph.neo4j_store import Neo4jGraphStore
from grid_data.network_study import NetworkModelInput, PandapowerProvider
from grid_data.p0_foundation import PhysicsOutcome


def main() -> None:
    root = Path(__file__).parents[3]
    payload = json.loads(
        (root / "services/grid-data/fixtures/synthetic-pilot/network.json").read_text()
    )
    payload.update(
        model_version="v1",
        validation_class="synthetic_demonstration",
        provenance={"source_url": "https://simbench.de", "license": "ODbL-1.0"},
    )
    projection = build_projection(NetworkModelInput(**payload))
    model = NetworkModelInput(**payload)
    audit = analyze_topology(projection)
    round_trip = validate_round_trip(projection, NetworkModelInput(**payload))
    store = Neo4jGraphStore()
    graph_name = None
    published = None
    delta_published = None
    try:
        capabilities = store.capabilities()
        memory = store.gds_memory_estimate()
        published = store.publish(projection)
        graph_name = store.project_gds(projection)
        pathways = store.gds_yens(
            graph_name,
            model_key=published["model_key"],
            source_id="synthetic-mv-b",
            target_id="synthetic-hv",
            k=3,
        )
        metrics = store.gds_topology_metrics(graph_name)
        portfolio = analyze_portfolio_interactions(
            projection, ["synthetic-mv-a", "synthetic-mv-b"], ["synthetic-hv"]
        )
        state_space = generate_state_space(
            [
                StateAxis("demand_factor", (0.9, 1.0, 1.1)),
                StateAxis("switching_state", ("normal", "alternate")),
            ]
        )
        capacity = PandapowerProvider(maximum_capacity_mw=20).calculate_import_capacity(model)
        outcome = PhysicsOutcome(
            "live-acceptance",
            "d" * 64,
            capacity.values.get("firm_import_capacity_mw"),
            None,
            bool(capacity.converged),
            capacity.values.get("binding_case"),
            capacity.values.get("binding_constraint"),
            capacity.provider,
            capacity.solver_version,
            model.validation_class,
            bool(capacity.converged),
            tuple(capacity.limitations),
        )
        attachment = attach_physics_outcomes(projection, [outcome])
        published_attachment = store.publish_physics_attachment(
            model_key=published["model_key"], attachment=attachment
        )
        next_model = replace(
            model,
            model_version="v2",
            loads=[{**row, "p_mw": float(row.get("p_mw", 0)) + 0.1} for row in model.loads],
        )
        next_projection = build_projection(next_model)
        delta = build_projection_delta(projection, next_projection)
        delta_published = store.publish_delta_snapshot(
            base_model_key=published["model_key"],
            next_projection=next_projection,
            delta=delta,
        )
        print(
            json.dumps(
                {
                    "capabilities": capabilities,
                    "memory_estimate": memory,
                    "projection": published,
                    "gds_graph": graph_name,
                    "gds_pathways": pathways,
                    "gds_metrics": metrics,
                    "portfolio": portfolio,
                    "state_space": {
                        "generated_count": state_space["generated_count"],
                        "state_space_sha256": state_space["state_space_sha256"],
                    },
                    "physics_attachment": published_attachment,
                    "delta_snapshot": delta_published,
                    "round_trip": round_trip,
                    "topology_accepted": audit["accepted_for_physics"],
                }
            )
        )
    finally:
        if graph_name:
            store.drop_gds(graph_name)
        if published:
            store.delete_projection(published["model_key"])
        if delta_published:
            store.delete_projection(delta_published["model_key"])
        store.close()


if __name__ == "__main__":
    main()
