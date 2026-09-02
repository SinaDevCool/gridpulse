"""Open SimBench importer and C1 validation-artifact builder."""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .network_study import NetworkModelInput, PandapowerProvider

SIMBENCH_SOURCE = "https://simbench.de/en/download/"
SIMBENCH_LICENSE = "ODbL-1.0"


def _finite(value: Any, fallback: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if math.isfinite(result) else fallback


def import_simbench_model(code: str = "1-MV-urban--0-sw") -> NetworkModelInput:
    try:
        import simbench  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError("Install the study extra to import SimBench models.") from error

    net = simbench.get_simbench_net(code)
    buses = [
        {
            "id": f"bus-{index}",
            "name": str(row.get("name") or f"Bus {index}"),
            "vn_kv": _finite(row["vn_kv"]),
            "min_vm_pu": _finite(row.get("min_vm_pu"), 0.95),
            "max_vm_pu": _finite(row.get("max_vm_pu"), 1.05),
        }
        for index, row in net.bus.iterrows()
        if bool(row.get("in_service", True))
    ]
    active_buses = {bus["id"] for bus in buses}
    branches = []
    for index, row in net.line.iterrows():
        start, end = f"bus-{int(row['from_bus'])}", f"bus-{int(row['to_bus'])}"
        if (
            not bool(row.get("in_service", True))
            or start not in active_buses
            or end not in active_buses
        ):
            continue
        branches.append(
            {
                "id": f"line-{index}",
                "from_bus": start,
                "to_bus": end,
                "length_km": _finite(row["length_km"]),
                "r_ohm_per_km": _finite(row["r_ohm_per_km"]),
                "x_ohm_per_km": _finite(row["x_ohm_per_km"]),
                "c_nf_per_km": _finite(row.get("c_nf_per_km")),
                "max_i_ka": _finite(row["max_i_ka"]),
                "max_loading_percent": _finite(row.get("max_loading_percent"), 100.0),
            }
        )
    transformers = []
    for index, row in net.trafo.iterrows():
        hv_bus, lv_bus = f"bus-{int(row['hv_bus'])}", f"bus-{int(row['lv_bus'])}"
        if (
            not bool(row.get("in_service", True))
            or hv_bus not in active_buses
            or lv_bus not in active_buses
        ):
            continue
        transformers.append(
            {
                "id": f"transformer-{index}",
                "hv_bus": hv_bus,
                "lv_bus": lv_bus,
                "sn_mva": _finite(row["sn_mva"]),
                "vn_hv_kv": _finite(row["vn_hv_kv"]),
                "vn_lv_kv": _finite(row["vn_lv_kv"]),
                "vk_percent": _finite(row["vk_percent"]),
                "vkr_percent": _finite(row["vkr_percent"]),
                "pfe_kw": _finite(row.get("pfe_kw")),
                "i0_percent": _finite(row.get("i0_percent")),
                "shift_degree": _finite(row.get("shift_degree")),
                "max_loading_percent": _finite(row.get("max_loading_percent"), 100.0),
            }
        )
    switches = []
    branch_ids = {branch["id"] for branch in branches}
    transformer_ids = {transformer["id"] for transformer in transformers}
    for index, row in net.switch.iterrows():
        element_type = str(row["et"])
        if element_type == "l":
            kind, element_id = "line", f"line-{int(row['element'])}"
        elif element_type == "t":
            kind, element_id = "transformer", f"transformer-{int(row['element'])}"
        elif element_type == "b":
            kind, element_id = "bus", f"bus-{int(row['element'])}"
        else:
            continue
        bus_id = f"bus-{int(row['bus'])}"
        if (
            bus_id not in active_buses
            or (kind == "line" and element_id not in branch_ids)
            or (kind == "transformer" and element_id not in transformer_ids)
            or (kind == "bus" and element_id not in active_buses)
        ):
            continue
        switches.append(
            {
                "id": f"switch-{index}",
                "bus": bus_id,
                "element_type": kind,
                "element_id": element_id,
                "closed": bool(row.get("closed", True)),
            }
        )
    loads = [
        {
            "id": f"load-{index}",
            "bus": f"bus-{int(row['bus'])}",
            "p_mw": _finite(row.get("p_mw")) * _finite(row.get("scaling"), 1.0),
            "q_mvar": _finite(row.get("q_mvar")) * _finite(row.get("scaling"), 1.0),
        }
        for index, row in net.load.iterrows()
        if bool(row.get("in_service", True)) and f"bus-{int(row['bus'])}" in active_buses
    ]
    generators = [
        {
            "id": f"external-grid-{index}",
            "bus": f"bus-{int(row['bus'])}",
            "kind": "external_grid",
            "slack": True,
            "vm_pu": _finite(row.get("vm_pu"), 1.0),
        }
        for index, row in net.ext_grid.iterrows()
        if bool(row.get("in_service", True)) and f"bus-{int(row['bus'])}" in active_buses
    ]
    generators.extend(
        {
            "id": f"generator-{index}",
            "bus": f"bus-{int(row['bus'])}",
            "p_mw": _finite(row.get("p_mw")) * _finite(row.get("scaling"), 1.0),
            "q_mvar": _finite(row.get("q_mvar")) * _finite(row.get("scaling"), 1.0),
        }
        for index, row in net.sgen.iterrows()
        if bool(row.get("in_service", True)) and f"bus-{int(row['bus'])}" in active_buses
    )
    import pandapower as pp  # type: ignore[import-not-found]

    pp.runpp(net, numba=False)
    energised_buses = {
        f"bus-{index}" for index, value in net.res_bus.vm_pu.items() if _finite(value, -1) > 0
    }
    eligible_loads = [load for load in loads if load["bus"] in energised_buses]
    connection_bus = (
        max(eligible_loads, key=lambda item: item["p_mw"])["bus"]
        if eligible_loads
        else next(iter(energised_buses))
    )
    return NetworkModelInput(
        buses=buses,
        branches=branches,
        transformers=transformers,
        loads=loads,
        generators=generators,
        switches=switches,
        contingencies=[],
        connection_bus=connection_bus,
        study_year=2026,
        provenance={
            "source": "SimBench",
            "source_url": SIMBENCH_SOURCE,
            "license": SIMBENCH_LICENSE,
            "benchmark_code": code,
            "geographic_truth": "representative German benchmark; not a real location",
        },
        model_id=f"simbench:{code}",
        model_version="simbench-open-model-v1",
        validation_class="synthetic_demonstration",
    )


def build_c1_validation_artifact(output: Path, code: str = "1-MV-urban--0-sw") -> dict[str, Any]:
    model = import_simbench_model(code)
    provider = PandapowerProvider(maximum_capacity_mw=100.0)
    results = [
        asdict(provider.run_base_case(model)),
        asdict(provider.run_voltage_assessment(model)),
        asdict(provider.calculate_import_capacity(model)),
    ]
    canonical_model = json.dumps(asdict(model), sort_keys=True, separators=(",", ":"))
    artifact = {
        "schema_version": "gridpulse-c1-validation-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_id": model.model_id,
        "model_version": model.model_version,
        "validation_class": model.validation_class,
        "model_sha256": hashlib.sha256(canonical_model.encode()).hexdigest(),
        "connection_bus": model.connection_bus,
        "element_counts": {
            "buses": len(model.buses),
            "lines": len(model.branches),
            "transformers": len(model.transformers),
            "loads": len(model.loads),
            "generators": len(model.generators),
        },
        "provenance": model.provenance,
        "results": results,
        "public_label": "Open benchmark solver validation — not location capacity",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
