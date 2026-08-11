"""50Hertz regional opportunity screening on public geography and synthetic physics.

The candidate names, coordinates, operator tags and nominal voltages are read from an OSM
Overpass response. All electrical topology, ratings, load, operating states and policies are
mocked. The output is a ranked diligence queue, never an available-capacity statement.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .activatable_capacity import calculate_activation_ensemble
from .network_study import NetworkModelInput, PandapowerProvider

MODEL_VERSION = "50hertz-regional-synthetic-v1"
OVERPASS_QUERY = (
    '[out:json][timeout:120];(nwr["power"="substation"]'
    '["operator"~"50Hertz",i](47,5,56,16););out center tags;'
)


@dataclass(frozen=True)
class Candidate:
    id: str
    name: str
    longitude: float
    latitude: float
    voltage_kv: float
    source_url: str


def _voltages(value: str) -> list[float]:
    parsed = []
    for item in value.split(";"):
        try:
            parsed.append(float(item) / 1000.0)
        except ValueError:
            continue
    return parsed


def load_50hertz_candidates(path: Path) -> list[Candidate]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    by_name: dict[str, Candidate] = {}
    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        name = str(tags.get("name") or "").strip()
        voltages = _voltages(str(tags.get("voltage") or ""))
        center = element.get("center") or element
        if not name or not voltages or max(voltages) < 380 or not center.get("lon"):
            continue
        candidate = Candidate(
            id=f"osm-{element['type']}-{element['id']}",
            name=name,
            longitude=float(center["lon"]),
            latitude=float(center["lat"]),
            voltage_kv=max(voltages),
            source_url=f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
        )
        key = " ".join(name.lower().split())
        previous = by_name.get(key)
        if previous is None or candidate.voltage_kv > previous.voltage_kv:
            by_name[key] = candidate
    return sorted(by_name.values(), key=lambda row: (row.name, row.id))


def _distance_km(a: Candidate, b: Candidate) -> float:
    lon1, lat1, lon2, lat2 = map(
        math.radians, (a.longitude, a.latitude, b.longitude, b.latitude)
    )
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def select_geographically_distributed(
    candidates: list[Candidate], limit: int = 30
) -> list[Candidate]:
    if limit < 3:
        raise ValueError("Regional study requires at least three candidates.")
    if len(candidates) <= limit:
        return candidates
    center_lon = sum(row.longitude for row in candidates) / len(candidates)
    center_lat = sum(row.latitude for row in candidates) / len(candidates)
    selected = [
        min(
            candidates,
            key=lambda row: (row.longitude - center_lon) ** 2 + (row.latitude - center_lat) ** 2,
        )
    ]
    while len(selected) < limit:
        remaining = [row for row in candidates if row not in selected]
        selected.append(
            max(
                remaining,
                key=lambda row: min(_distance_km(row, chosen) for chosen in selected),
            )
        )
    return sorted(selected, key=lambda row: (row.name, row.id))


def _edges(candidates: list[Candidate]) -> list[tuple[int, int]]:
    edges: set[tuple[int, int]] = set()
    # Connect each site to its three closest peers. This produces a deterministic mesh but
    # does not assert that any public transmission circuit follows these straight paths.
    for index, row in enumerate(candidates):
        nearest = sorted(
            (other for other in range(len(candidates)) if other != index),
            key=lambda other: _distance_km(row, candidates[other]),
        )[:3]
        edges.update(tuple(sorted((index, other))) for other in nearest)
    return sorted(edges)


def build_regional_model(
    candidates: list[Candidate], *, current_ka: float = 2.2, load_scale: float = 1.0
) -> NetworkModelInput:
    edges = _edges(candidates)
    center_lon = sum(row.longitude for row in candidates) / len(candidates)
    center_lat = sum(row.latitude for row in candidates) / len(candidates)
    slack = min(
        candidates,
        key=lambda row: (row.longitude - center_lon) ** 2 + (row.latitude - center_lat) ** 2,
    )
    branches = []
    for number, (start, end) in enumerate(edges, start=1):
        distance = _distance_km(candidates[start], candidates[end])
        branches.append(
            {
                "id": f"mock-380kv-{number:03d}",
                "from_bus": candidates[start].id,
                "to_bus": candidates[end].id,
                "length_km": round(max(5.0, min(120.0, distance * 1.12)), 3),
                "r_ohm_per_km": 0.028,
                "x_ohm_per_km": 0.08,
                # Reactive compensation and exact circuit construction are unknown. Setting
                # shunt capacitance to zero avoids inventing uncompensated charging behaviour.
                "c_nf_per_km": 0.0,
                "max_i_ka": current_ka,
                "max_loading_percent": 100.0,
                "assumption_id": "mock-380kv-overhead-line-v1",
            }
        )
    loads = []
    for row in candidates:
        seed = int(hashlib.sha256(row.id.encode()).hexdigest()[:6], 16)
        p_mw = round((15.0 + seed % 26) * load_scale, 3)
        loads.append(
            {
                "id": f"mock-load-{row.id}",
                "bus": row.id,
                "p_mw": p_mw,
                "q_mvar": round(p_mw * math.tan(math.acos(0.97)), 4),
                "assumption_id": "mock-regional-base-load-v1",
            }
        )
    return NetworkModelInput(
        buses=[
            {
                "id": row.id,
                "name": row.name,
                "vn_kv": 380.0,
                "min_vm_pu": 0.95,
                "max_vm_pu": 1.05,
                "longitude": row.longitude,
                "latitude": row.latitude,
            }
            for row in candidates
        ],
        branches=branches,
        transformers=[],
        loads=loads,
        generators=[
            {"id": "mock-regional-upstream", "bus": slack.id, "kind": "external_grid",
             "slack": True, "vm_pu": 1.02}
        ],
        switches=[],
        contingencies=[],
        connection_bus=candidates[0].id,
        study_year=2026,
        provenance={
            "source_url": "https://www.openstreetmap.org/",
            "license": "ODbL-1.0 geography; GridPulse synthetic electrical assumptions",
            "operator_focus": "50Hertz Transmission",
            "operator_model": False,
            "geographic_truth": "OSM names, coordinates, operator tags and voltage filters",
            "electrical_truth": "fully_synthetic",
        },
        model_id="50hertz-regional-geographic-synthetic",
        model_version=MODEL_VERSION,
        validation_class="synthetic_demonstration",
    )


def _candidate_contingencies(model: NetworkModelInput, bus_id: str) -> list[dict[str, str]]:
    incident = [
        branch for branch in model.branches
        if branch["from_bus"] == bus_id or branch["to_bus"] == bus_id
    ]
    return [
        {"id": f"{branch['id']}-out", "element_type": "line", "element_id": branch["id"]}
        for branch in incident
    ]


def _percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower, upper = math.floor(position), math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def build_regional_screening_artifact(
    source: Path, output: Path, *, limit: int = 30
) -> dict[str, Any]:
    available = load_50hertz_candidates(source)
    candidates = select_geographically_distributed(available, limit)
    scenarios = (
        ("conservative", 0.55, 1.20),
        ("central", 0.80, 1.00),
        ("optimistic", 1.05, 0.80),
    )
    solved: dict[str, dict[str, dict[str, Any]]] = {row.id: {} for row in candidates}
    for label, current_ka, load_scale in scenarios:
        model = build_regional_model(candidates, current_ka=current_ka, load_scale=load_scale)
        provider = PandapowerProvider(
            maximum_capacity_mw=1500.0,
            capacity_tolerance_mw=5.0,
            maximum_loading_percent=100.0,
            incremental_load_power_factor=0.97,
        )
        slack_bus = model.generators[0]["bus"]
        for candidate in candidates:
            if candidate.id == slack_bus:
                continue
            study = replace(
                model,
                connection_bus=candidate.id,
                contingencies=_candidate_contingencies(model, candidate.id),
            )
            n0 = provider.calculate_import_capacity(replace(study, contingencies=[]))
            n1 = provider.calculate_import_capacity(study)
            solved[candidate.id][label] = {
                "n0_mw": float(n0.values["firm_import_capacity_mw"]),
                "n1_mw": float(n1.values["firm_import_capacity_mw"]),
                "binding_case": n1.values.get("binding_case"),
                "binding_constraint": n1.values.get("binding_constraint"),
                "is_lower_bound": bool(n1.values.get("capacity_is_lower_bound")),
            }
    results = []
    for candidate in candidates:
        cases = solved[candidate.id]
        if not cases:  # Unbounded synthetic slack/reference site is never ranked.
            continue
        firm_values = [case["n1_mw"] for case in cases.values()]
        central = cases["central"]
        activation = calculate_activation_ensemble(
            result_id=f"50hertz-regional-{candidate.id}",
            electrical_ceiling_mw=central["n0_mw"],
            n1_capacity_mw=central["n1_mw"],
        )
        central_activation = activation.pop("central_result")
        firm_central = round(central["n1_mw"], 2)
        flexible_proxy = max(firm_central, central_activation["flexible"]["capacity_mw"])
        bess_proxy = max(firm_central, central_activation["bess_assisted"]["capacity_mw"])
        results.append(
            {
                "candidate_id": candidate.id,
                "location": candidate.name,
                "coordinates": [candidate.longitude, candidate.latitude],
                "mapped_voltage_kv": candidate.voltage_kv,
                "source_url": candidate.source_url,
                "firm_proxy": {
                    "p10_mw": round(_percentile(firm_values, 0.10), 2),
                    "p50_mw": round(_percentile(firm_values, 0.50), 2),
                    "p90_mw": round(_percentile(firm_values, 0.90), 2),
                    "central_mw": round(central["n1_mw"], 2),
                    "central_is_lower_bound": central["is_lower_bound"],
                },
                "n0_central_mw": round(central["n0_mw"], 2),
                "flexible_proxy_mw": flexible_proxy,
                "bess_assisted_proxy_mw": bess_proxy,
                "restricted_hours_per_year": central_activation["flexible"]["restricted_hours"],
                "restricted_energy_mwh": central_activation["flexible"]["restricted_energy_mwh"],
                "battery_power_mw": central_activation["bess_assisted"]["battery_power_mw"],
                "battery_energy_mwh": central_activation["bess_assisted"]["battery_energy_mwh"],
                "binding_case": central["binding_case"],
                "binding_constraint": central["binding_constraint"],
                "electrical_scenarios": cases,
                "hourly_ensemble": activation,
                "capacity_claim": False,
                "display_as_capacity": False,
            }
        )
    results.sort(
        key=lambda row: (
            row["firm_proxy"]["p10_mw"],
            row["flexible_proxy_mw"],
            -row["restricted_hours_per_year"],
        ),
        reverse=True,
    )
    for rank, row in enumerate(results, start=1):
        row["rank"] = rank
        row["opportunity_tier"] = "A" if rank <= 5 else "B" if rank <= 15 else "C"
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    results_sha = hashlib.sha256(
        json.dumps(results, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    artifact = {
        "schema_version": "gridpulse-50hertz-regional-screening-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result_mode": "real_geography_synthetic_electrical_screening",
        "scope": {
            "public_records_found": len(available),
            "geographically_distributed_sites_selected": len(candidates),
            "ranked_sites": len(results),
            "excluded_reference_sites": len(candidates) - len(results),
        },
        "source": {
            "name": "OpenStreetMap Overpass candidate extraction",
            "query": OVERPASS_QUERY,
            "retrieved_input_sha256": source_sha,
            "licence": "ODbL-1.0",
            "official_50hertz_context": "https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss",
        },
        "calculation": {
            "physics": "Pandapower AC Newton-Raphson incremental import search",
            "n0": "maximum incremental demand satisfying convergence, voltage and thermal limits",
            "n1": "minimum capacity across mocked incident-line outages",
            "electrical_uncertainty": [
                {"case": label, "line_current_ka": current, "base_load_scale": scale}
                for label, current, scale in scenarios
            ],
            "hourly_scenarios_per_site": 27,
            "hours_per_hourly_scenario": 8760,
        },
        "assumptions": {
            "topology": "synthetic three-nearest-neighbour 380 kV mesh",
            "line_model": "synthetic series impedance and thermal rating; shunt charging omitted because compensation is unknown",
            "loads": "deterministic synthetic 15-40 MW nodal base loads before scenario scaling",
            "security": "incident synthetic circuit outages only; not the 50Hertz contingency list",
            "flexibility": "representative interruptibility and four-hour BESS policy",
        },
        "results": results,
        "results_sha256": results_sha,
        "business_use": "Rank sites for evidence acquisition and operator connection studies.",
        "prohibited_interpretation": "Not actual free capacity, a 50Hertz study, a GridCARE result, a connection offer, or a reservation.",
        "promotion_gate": "Replace topology, ratings, states, measurements, queues and contingencies; reconcile with 50Hertz outcomes.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
