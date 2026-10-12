from __future__ import annotations

import hashlib
from typing import Any

NETWORK_VERSION = "de-bb-synthetic-reference-network-v1"


def _round(value: float, digits: int = 1) -> float:
    return round(value, digits)


def _seed(node_id: str) -> float:
    digest = hashlib.sha256(node_id.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / (2**64 - 1)


def _case(
    key: str,
    label: str,
    branches: list[dict[str, Any]],
    firm_mw: float,
    load_multiplier: float,
    outage: bool = False,
) -> dict[str, Any]:
    available = [
        max(
            0.0,
            branch["synthetic_rating_mw"] - branch["synthetic_base_loading_mw"] * load_multiplier,
        )
        for branch in branches
    ]
    constraints = {
        "transformer": available[0],
        "upstream_branch": min(available[1], available[0] * 0.52) if outage else available[1],
        "connection_branch": min(available[2], available[1] * 0.55) if outage else available[2],
        "voltage_proxy": max(
            0.0,
            branches[2]["synthetic_rating_mw"] * (0.86 - branches[2]["reactance_proxy"] * 0.9),
        ),
    }
    binding, limit = min(constraints.items(), key=lambda item: item[1])
    voltage_pu = max(0.88, 1 - (firm_mw / max(constraints["voltage_proxy"], 1)) * 0.045)
    return {
        "key": key,
        "label": label,
        "transfer_limit_mw": _round(limit),
        "residual_margin_mw": _round(limit - firm_mw),
        "voltage_proxy_pu": _round(voltage_pu, 3),
        "passes_declared_firm_requirement": limit >= firm_mw and voltage_pu >= 0.95,
        "binding_constraint": binding,
    }


def screen_release_b_network(payload: dict[str, Any]) -> dict[str, Any]:
    """Run a deterministic, unvalidated reference-network security screen."""
    node_id = str(payload["node_id"])
    voltage = min(500.0, max(20.0, float(payload.get("voltage_kv", 20))))
    firm_mw = max(0.0, float(payload["minimum_firm_mw"]))
    distance_km = max(0.0, float(payload.get("distance_km", 0)))
    year = int(payload.get("target_energisation_year", 2028))
    redundancy = str(payload.get("redundancy", "single_feed"))
    seed = _seed(node_id)
    voltage_base = (
        620 if voltage >= 380 else 330 if voltage >= 220 else 145 if voltage >= 110 else 38
    )
    distance_derate = max(0.7, 1 - distance_km * 0.008)
    ratings = [
        voltage_base * (0.78 + seed * 0.18),
        voltage_base * (0.66 + ((seed * 7.3) % 1) * 0.2),
        voltage_base * distance_derate * (0.58 + ((seed * 13.1) % 1) * 0.22),
    ]
    branches = []
    for index, rating in enumerate(ratings):
        branches.append(
            {
                "id": f"{node_id}-synthetic-branch-{index + 1}",
                "from": "synthetic-source" if index == 0 else f"synthetic-bus-{index}",
                "to": node_id if index == 2 else f"synthetic-bus-{index + 1}",
                "voltage_kv": voltage,
                "synthetic_rating_mw": _round(rating),
                "synthetic_base_loading_mw": _round(
                    rating * (0.38 + ((seed * (index + 3) * 5.7) % 1) * 0.28)
                ),
                "reactance_proxy": _round(0.04 + distance_km * 0.0015 + index * 0.012, 3),
                "evidence_status": "synthetic",
            }
        )
    sensitivities = [
        _case("base", "Base synthetic system state", branches, firm_mw, 1),
        _case("high_system_load", "+15% synthetic system loading", branches, firm_mw, 1.15),
        _case("largest_branch_outage", "Largest-branch outage proxy", branches, firm_mw, 1, True),
        _case(
            "target_year_stress",
            f"{year} synthetic demand-growth stress",
            branches,
            firm_mw,
            1 + max(0, year - 2028) * 0.012,
        ),
    ]
    base, outage = sensitivities[0], sensitivities[2]
    selected = base if redundancy == "single_feed" else outage
    return {
        "network_version": NETWORK_VERSION,
        "evidence_status": "synthetic",
        "validation_status": "unvalidated_reference_model",
        "not_for_connection_decision": True,
        "topology": {
            "buses": 4,
            "branches": 3,
            "source": "synthetic-source",
            "connection_bus": node_id,
        },
        "branches": branches,
        "n0_transfer_limit_mw": base["transfer_limit_mw"],
        "n1_transfer_limit_mw": outage["transfer_limit_mw"],
        "selected_security_limit_mw": selected["transfer_limit_mw"],
        "residual_security_margin_mw": selected["residual_margin_mw"],
        "binding_constraint": selected["binding_constraint"],
        "sensitivities": sensitivities,
        "replacement_target": "Operator-supplied CGMES/planning model and reviewed security criteria",
        "limitations": [
            "Not AC or DC power flow.",
            "No operator ratings, loading, protection, fault levels or queue data.",
            "Not available or confirmed grid capacity.",
        ],
    }
