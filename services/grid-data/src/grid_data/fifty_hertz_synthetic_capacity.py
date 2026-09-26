"""Calculate a 50Hertz-focused, geographically anchored synthetic opportunity case.

Only the Thyrow yard locations and nominal voltages come from public OSM mapping. Transformer
ratings, base loading, power factor, operating state and contingencies are explicit GridPulse
assumptions. Results rank investigation opportunities; they are not available grid capacity.
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

MODEL_ID = "50hertz-thyrow-geographic-synthetic"
MODEL_VERSION = "50hertz-thyrow-screening-v1"
SLACK_BUS = "osm-way-940470389"  # mapped 380 kV yard

# Public map anchors. Electrical relationships between them remain synthetic.
THYROW_YARDS = (
    ("osm-way-940470389", "Thyrow 380 kV yard", 380.0, 13.3065330333, 52.22935145),
    ("osm-way-29331499", "Thyrow 220 kV yard", 220.0, 13.3059442941, 52.2307456706),
    ("osm-way-940470388", "Thyrow 110 kV yard", 110.0, 13.3045748727, 52.2316837091),
)


def build_thyrow_synthetic_model(connection_bus: str = THYROW_YARDS[1][0]) -> NetworkModelInput:
    buses = [
        {
            "id": row[0],
            "name": row[1],
            "vn_kv": row[2],
            "min_vm_pu": 0.95,
            "max_vm_pu": 1.05,
            "longitude": row[3],
            "latitude": row[4],
        }
        for row in THYROW_YARDS
    ]
    transformers = []
    # Two parallel banks per interface make the N-1 study meaningful. The values are a
    # transparent engineering scenario, not observed 50Hertz equipment data.
    for index in (1, 2):
        transformers.extend(
            [
                {
                    "id": f"mock-380-220-bank-{index}",
                    "hv_bus": THYROW_YARDS[0][0],
                    "lv_bus": THYROW_YARDS[1][0],
                    "sn_mva": 600.0,
                    "vn_hv_kv": 380.0,
                    "vn_lv_kv": 220.0,
                    "vk_percent": 13.0,
                    "vkr_percent": 0.35,
                    "max_loading_percent": 100.0,
                    "assumption_id": "mock-thyrow-transformer-catalogue-v1",
                },
                {
                    "id": f"mock-220-110-bank-{index}",
                    "hv_bus": THYROW_YARDS[1][0],
                    "lv_bus": THYROW_YARDS[2][0],
                    "sn_mva": 300.0,
                    "vn_hv_kv": 220.0,
                    "vn_lv_kv": 110.0,
                    "vk_percent": 12.0,
                    "vkr_percent": 0.4,
                    "max_loading_percent": 100.0,
                    "assumption_id": "mock-thyrow-transformer-catalogue-v1",
                },
            ]
        )
    loads = [
        {"id": "mock-base-load-220", "bus": THYROW_YARDS[1][0], "p_mw": 180.0,
         "q_mvar": round(180.0 * math.tan(math.acos(0.97)), 4)},
        {"id": "mock-base-load-110", "bus": THYROW_YARDS[2][0], "p_mw": 140.0,
         "q_mvar": round(140.0 * math.tan(math.acos(0.97)), 4)},
    ]
    contingencies = [
        {"id": f"{item['id']}-out", "element_type": "transformer", "element_id": item["id"]}
        for item in transformers
    ]
    return NetworkModelInput(
        buses=buses,
        branches=[],
        transformers=transformers,
        loads=loads,
        generators=[{"id": "mock-upstream-grid", "bus": SLACK_BUS, "kind": "external_grid",
                     "slack": True, "vm_pu": 1.02}],
        switches=[],
        contingencies=contingencies,
        connection_bus=connection_bus,
        study_year=2026,
        provenance={
            "operator_focus": "50Hertz Transmission",
            "source_url": "https://www.openstreetmap.org/way/940470389",
            "license": "ODbL-1.0 for mapped geography; GridPulse-authored synthetic assumptions",
            "geography_source": "OpenStreetMap",
            "geography_source_url": "https://www.openstreetmap.org/way/940470389",
            "official_context_url": "https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss",
            "geographic_truth": "mapped_yard_locations_and_nominal_voltage_only",
            "electrical_truth": "fully_synthetic",
            "operator_model": False,
        },
        model_id=MODEL_ID,
        model_version=MODEL_VERSION,
        validation_class="synthetic_demonstration",
    )


def build_fifty_hertz_synthetic_capacity_artifact(output: Path) -> dict[str, Any]:
    model = build_thyrow_synthetic_model()
    provider = PandapowerProvider(
        maximum_capacity_mw=1000.0,
        capacity_tolerance_mw=0.25,
        maximum_loading_percent=100.0,
        incremental_load_power_factor=0.97,
    )
    results = []
    for yard in THYROW_YARDS[1:]:
        candidate = replace(model, connection_bus=yard[0])
        n0 = provider.calculate_import_capacity(replace(candidate, contingencies=[]))
        n1 = provider.calculate_import_capacity(candidate)
        n0_mw = float(n0.values["firm_import_capacity_mw"])
        n1_mw = float(n1.values["firm_import_capacity_mw"])
        flexible_proxy_mw = round(min(n0_mw, n1_mw * 1.20), 2)
        results.append(
            {
                "public_node_id": yard[0],
                "location": yard[1],
                "nominal_voltage_kv": yard[2],
                "coordinates": [yard[3], yard[4]],
                "n0_additional_import_mw": round(n0_mw, 2),
                "n1_firm_proxy_mw": round(n1_mw, 2),
                "flexible_proxy_mw": flexible_proxy_mw,
                "flexibility_uplift_mw": round(flexible_proxy_mw - n1_mw, 2),
                "binding_case": n1.values.get("binding_case"),
                "binding_constraint": n1.values.get("binding_constraint"),
                "opportunity_score": round(100.0 * n1_mw / max(1.0, 1000.0), 1),
                "capacity_claim": False,
                "display_as_capacity": False,
                "interpretation": "Synthetic screening proxy for prioritising a real operator study.",
            }
        )
    results.sort(key=lambda row: row["n1_firm_proxy_mw"], reverse=True)
    for rank, result in enumerate(results, start=1):
        result["rank"] = rank
    model_sha = hashlib.sha256(
        json.dumps(asdict(model), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    results_sha = hashlib.sha256(
        json.dumps(results, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    artifact = {
        "schema_version": "gridpulse-50hertz-synthetic-opportunity-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "50Hertz / Thyrow mapped voltage yards",
        "as_of_context": "50Hertz public connection map context dated 2026-03-31",
        "result_mode": "real_geography_synthetic_electrical_screening",
        "model": {"id": MODEL_ID, "version": MODEL_VERSION, "sha256": model_sha,
                  "solver": "pandapower-newton-raphson"},
        "formula": {
            "n0": "max ΔP such that AC power flow converges and voltage/thermal limits hold",
            "n1": "min over each mocked transformer outage of feasible max ΔP",
            "flexible_proxy": "min(N-0, 1.20 × N-1); illustrative 20% interruptible uplift",
        },
        "assumptions": {
            "base_load_mw": {"220_kv": 180.0, "110_kv": 140.0},
            "power_factor": 0.97,
            "transformers": "2x600 MVA 380/220 kV and 2x300 MVA 220/110 kV",
            "contingencies": "one mocked transformer bank out at a time",
            "missing": ["actual topology", "actual ratings", "SCADA loading", "switch states",
                        "operator contingency policy", "connection queue", "planned outages"],
        },
        "results": results,
        "results_sha256": results_sha,
        "decision": {
            "screen_first": results[0]["location"],
            "reason": "highest synthetic N-1 additional-import proxy in this limited case",
            "next_gate": "replace every mocked electrical input and obtain 50Hertz study confirmation",
        },
        "permitted_interpretation": "A reproducible hypothesis and site-screening priority.",
        "prohibited_interpretation": "Not free capacity, a 50Hertz result, GridCARE output, connection offer, or reservation.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
