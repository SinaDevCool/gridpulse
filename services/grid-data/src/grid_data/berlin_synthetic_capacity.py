"""Build a geographically anchored, electrically synthetic Berlin capacity release.

The public node coordinates and identifiers originate from the accepted OSM release. All
electrical parameters, operating states and contingencies are synthetic assumptions. The
artifact is a methodology demonstration and must never be represented as available capacity.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .network_study import NetworkModelInput, PandapowerProvider

MODEL_ID = "berlin-geographic-synthetic-110kv"
MODEL_VERSION = "berlin-synthetic-release1-v1"
BOUNDARY = [13.18, 52.39, 13.62, 52.66]
SLACK_NODE_ID = "osm-way-30303506"

# Accepted mapped substations. Coordinates and IDs are real public geography; electrical
# connectivity and parameters are not operator data.
BERLIN_NODES = (
    ("osm-way-30132758", "Teufelsbruch", 13.211796582, 52.580706527),
    ("osm-way-46615737", "Charlottenburg", 13.315542013, 52.522075727),
    ("osm-way-43163132", "Reuter", 13.248922923, 52.531714623),
    ("osm-way-30303506", "Mitte", 13.368310170, 52.503031100),
    ("osm-way-30954714", "Friedrichshain", 13.456070408, 52.521449115),
    ("osm-way-22973052", "Wuhlheide", 13.506110061, 52.473776183),
    ("osm-way-1086444688", "Altes Gaswerk Marienfelde", 13.372871060, 52.438791700),
    ("osm-way-30132732", "Oberhavel", 13.212113475, 52.579431100),
    ("osm-way-29051015", "Buch", 13.468426533, 52.632651150),
    ("osm-way-27328809", "Wittenau", 13.307193514, 52.581637257),
    ("osm-way-27259944", "Lichterfelde", 13.310088900, 52.423916086),
    ("osm-way-27159777", "Gesundbrunnen", 13.383171620, 52.548770520),
    ("osm-way-27527457", "Steglitz", 13.329883688, 52.443919039),
    ("osm-way-39250468", "Gelnitzstrasse", 13.586350300, 52.456448000),
    ("osm-way-39243044", "Biesdorf Nord", 13.537313767, 52.537712217),
    ("osm-way-39183360", "Fennpfuhl", 13.479349333, 52.533725025),
)


def _distance_km(a: tuple, b: tuple) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[2], a[3], b[2], b[3]))
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def _synthetic_edges() -> list[tuple[int, int]]:
    """Create a deterministic meshed ring plus geographic chords."""
    center_lon = sum(row[2] for row in BERLIN_NODES) / len(BERLIN_NODES)
    center_lat = sum(row[3] for row in BERLIN_NODES) / len(BERLIN_NODES)
    order = sorted(
        range(len(BERLIN_NODES)),
        key=lambda i: math.atan2(BERLIN_NODES[i][3] - center_lat, BERLIN_NODES[i][2] - center_lon),
    )
    edges = {
        tuple(sorted((order[index], order[(index + 1) % len(order)])))
        for index in range(len(order))
    }
    # Add the nearest non-ring neighbour for every bus. This improves synthetic N-1 resilience
    # without claiming that the chord follows a mapped cable route.
    for index, node in enumerate(BERLIN_NODES):
        nearest = sorted(
            (candidate for candidate in range(len(BERLIN_NODES)) if candidate != index),
            key=lambda candidate: _distance_km(node, BERLIN_NODES[candidate]),
        )
        for candidate in nearest:
            edge = tuple(sorted((index, candidate)))
            if edge not in edges:
                edges.add(edge)
                break
    return sorted(edges)


def build_berlin_synthetic_model(connection_bus: str | None = None) -> NetworkModelInput:
    buses = [
        {
            "id": row[0],
            "name": row[1],
            "vn_kv": 110.0,
            "min_vm_pu": 0.95,
            "max_vm_pu": 1.05,
            "longitude": row[2],
            "latitude": row[3],
        }
        for row in BERLIN_NODES
    ]
    branches = []
    for index, (start, end) in enumerate(_synthetic_edges(), start=1):
        length = max(1.0, _distance_km(BERLIN_NODES[start], BERLIN_NODES[end]) * 1.18)
        branches.append(
            {
                "id": f"synthetic-110kv-{index:02d}",
                "from_bus": BERLIN_NODES[start][0],
                "to_bus": BERLIN_NODES[end][0],
                "length_km": round(length, 3),
                "r_ohm_per_km": 0.075,
                "x_ohm_per_km": 0.31,
                "c_nf_per_km": 11.0,
                "max_i_ka": 0.82,
                "max_loading_percent": 100.0,
                "assumption_id": "synthetic-110kv-cable-v1",
            }
        )
    loads = []
    for index, row in enumerate(BERLIN_NODES):
        p_mw = 7.0 + (index % 5) * 2.5
        power_factor = 0.96
        loads.append(
            {
                "id": f"synthetic-base-load-{index + 1:02d}",
                "bus": row[0],
                "p_mw": p_mw,
                "q_mvar": round(p_mw * math.tan(math.acos(power_factor)), 4),
                "assumption_id": "synthetic-winter-peak-v1",
            }
        )
    contingencies = [
        {"id": f"{branch['id']}-out", "element_type": "line", "element_id": branch["id"]}
        for branch in branches
    ]
    return NetworkModelInput(
        buses=buses,
        branches=branches,
        transformers=[],
        loads=loads,
        generators=[
            {
                "id": "synthetic-berlin-grid-interface",
                "bus": SLACK_NODE_ID,
                "kind": "external_grid",
                "slack": True,
                "vm_pu": 1.02,
            }
        ],
        switches=[],
        contingencies=contingencies,
        connection_bus=connection_bus or BERLIN_NODES[0][0],
        study_year=2026,
        provenance={
            "source": "GridPulse Berlin Release 1 synthetic electrical twin",
            "source_url": "https://gridpulseinsights.com/data-sources",
            "license": "OSM geography with GridPulse synthetic assumptions",
            "geographic_truth": "real_geography_synthetic_electrical_model",
            "evidence_class": "synthetic_geographic_demonstration",
            "operator_model": False,
        },
        model_id=MODEL_ID,
        model_version=MODEL_VERSION,
        validation_class="synthetic_demonstration",
    )


def _coverage_feature() -> dict[str, Any]:
    west, south, east, north = BOUNDARY
    return {
        "type": "Feature",
        "id": "berlin-synthetic-release1-coverage",
        "properties": {
            "name": "Berlin synthetic calculation coverage",
            "evidence_class": "synthetic_geographic_demonstration",
            "model_version": MODEL_VERSION,
            "calculated_node_count": len(BERLIN_NODES) - 1,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
        },
    }


def build_berlin_synthetic_capacity_artifact(output: Path) -> dict[str, Any]:
    base_model = build_berlin_synthetic_model()
    provider = PandapowerProvider(
        maximum_capacity_mw=300.0,
        capacity_tolerance_mw=0.25,
        maximum_loading_percent=100.0,
    )
    results = []
    # The external-grid/slack bus has an unbounded upstream source in this synthetic model.
    # Publishing its search ceiling would falsely look like a capacity result, so it is excluded.
    candidate_nodes = [node for node in BERLIN_NODES if node[0] != SLACK_NODE_ID]
    for index, node in enumerate(candidate_nodes, start=1):
        model = replace(base_model, connection_bus=node[0], contingencies=[])
        n0 = provider.calculate_import_capacity(model)
        secured = provider.calculate_import_capacity(replace(model, contingencies=base_model.contingencies))
        n0_mw = float(n0.values["firm_import_capacity_mw"])
        n1_mw = float(secured.values["firm_import_capacity_mw"])
        n0_is_lower_bound = str(n0.values.get("binding_constraint")) == "search_ceiling"
        binding_case = str(secured.values.get("binding_case") or "unknown")
        binding_constraint = str(secured.values.get("binding_constraint") or "unknown")
        result_id = f"berlin-synthetic-r1-{index:02d}"
        results.append(
            {
                "resultId": result_id,
                "studyRunId": "berlin-synthetic-release1",
                "publicNodeId": node[0],
                "candidateId": f"berlin-synthetic-candidate-{index:02d}",
                "modelBusId": node[0],
                "valueMw": n1_mw,
                # A search-ceiling hit is only a lower bound, not an exact envelope.
                "n0CapacityMw": None if n0_is_lower_bound else n0_mw,
                "firmCapacityMw": n1_mw,
                "flexibleCapacityMw": None,
                "bessAssistedCapacityMw": None,
                "stagedInitialCapacityMw": None,
                "eventualCapacityMw": None,
                "restrictedHours": None,
                "restrictedEnergyMwh": None,
                "bindingCategory": binding_constraint,
                "bindingCase": binding_case,
                "validationState": "calculated",
                "calculatedAt": datetime.now(timezone.utc).isoformat(),
                "modelVersion": MODEL_VERSION,
                "scenarioLabel": "Berlin synthetic winter-peak N-1 demonstration",
                "securityCase": "n_1",
                "evidenceClass": "synthetic_geographic_demonstration",
                "geographicTruth": "real_geography_synthetic_electrical_model",
            }
        )
    model_hash = hashlib.sha256(
        json.dumps(asdict(base_model), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    results_hash = hashlib.sha256(
        json.dumps(results, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    artifact = {
        "schema_version": "gridpulse-berlin-synthetic-capacity-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result_mode": "synthetic_geographic_demonstration",
        "model": {
            "id": MODEL_ID,
            "version": MODEL_VERSION,
            "model_sha256": model_hash,
            "solver": "pandapower-newton-raphson",
            "solver_version": results and provider._solver_version,
            "node_count": len(BERLIN_NODES),
            "branch_count": len(base_model.branches),
            "contingency_count": len(base_model.contingencies),
        },
        "coverage": {"type": "FeatureCollection", "features": [_coverage_feature()]},
        "assumptions": {
            "topology": "Real mapped node anchors; synthetic meshed ring and nearest-neighbour chords.",
            "line_catalogue": "Synthetic 110 kV cable: r=0.075 ohm/km, x=0.31 ohm/km, c=11 nF/km, max_i=0.82 kA.",
            "operating_state": "Synthetic winter peak with 0.96 power factor and 7-17 MW base load per bus.",
            "security": "Every synthetic line is evaluated as an individual N-1 outage.",
        },
        "results": results,
        "results_sha256": results_hash,
        "permitted_interpretation": "Methodology demonstration on real Berlin map anchors with synthetic electrical assumptions.",
        "prohibited_interpretation": "Not available capacity, an operator network study, connection offer or reservation.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
