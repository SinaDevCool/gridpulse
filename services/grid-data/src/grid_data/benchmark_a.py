"""Benchmark A: reproducible AC capacity and N-1 solver consistency checks.

The current reference uses pandapower's Iwamoto Newton-Raphson implementation,
which is algorithmically distinct but not an independent software engine.  The
artifact states that limitation explicitly so it cannot satisfy the future
PowerModels/MATPOWER external-solver gate by accident.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
from contextlib import redirect_stdout
from dataclasses import asdict, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .benchmark_model import import_simbench_model
from .network_study import NetworkModelInput, PandapowerProvider

SCHEMA_VERSION = "gridpulse-benchmark-a-v1"
DEFAULT_CODES = ("1-MV-urban--0-sw", "1-MV-rural--0-sw")


class IwamotoReferenceProvider(PandapowerProvider):
    """Same model contract/checks, alternate nonlinear solution algorithm."""

    def _solve(self, net) -> dict[str, Any]:
        try:
            # pandapower's Iwamoto implementation prints its internal multiplier
            # unconditionally; keep the machine-readable benchmark CLI quiet.
            with redirect_stdout(io.StringIO()):
                self._pp.runpp(
                    net,
                    algorithm="iwamoto_nr",
                    calculate_voltage_angles=True,
                    init="auto",
                    numba=False,
                )
        except Exception as error:  # noqa: BLE001
            return {"converged": False, "error": type(error).__name__}
        voltages = [
            float(value) for value in net.res_bus.vm_pu.tolist() if math.isfinite(float(value))
        ]
        line_loadings = [
            float(value)
            for value in net.res_line.loading_percent.tolist()
            if math.isfinite(float(value))
        ]
        trafo_loadings = [
            float(value)
            for value in net.res_trafo.loading_percent.tolist()
            if math.isfinite(float(value))
        ]
        violations: list[str] = []
        active_load_buses = {
            int(bus) for bus in net.load.loc[net.load.in_service.astype(bool), "bus"].tolist()
        }
        supplied_load_buses = {
            bus
            for bus in active_load_buses
            if bus in net.res_bus.index and math.isfinite(float(net.res_bus.at[bus, "vm_pu"]))
        }
        if supplied_load_buses != active_load_buses:
            violations.append("unsupplied_load_bus")
        for bus_index, voltage in net.res_bus.vm_pu.items():
            if not math.isfinite(float(voltage)):
                continue
            minimum = max(self._vmin, float(net.bus.at[bus_index, "min_vm_pu"]))
            maximum = min(self._vmax, float(net.bus.at[bus_index, "max_vm_pu"]))
            if float(voltage) < minimum and "minimum_bus_voltage" not in violations:
                violations.append("minimum_bus_voltage")
            if float(voltage) > maximum and "maximum_bus_voltage" not in violations:
                violations.append("maximum_bus_voltage")
        if line_loadings and max(line_loadings) > self._max_loading:
            violations.append("line_thermal_loading")
        if trafo_loadings and max(trafo_loadings) > self._max_loading:
            violations.append("transformer_thermal_loading")
        return {
            "converged": True,
            "passes": not violations,
            "violations": violations,
            "minimum_voltage_pu": round(min(voltages), 5) if voltages else None,
            "maximum_voltage_pu": round(max(voltages), 5) if voltages else None,
            "maximum_line_loading_percent": round(max(line_loadings), 3)
            if line_loadings
            else 0.0,
            "maximum_transformer_loading_percent": round(max(trafo_loadings), 3)
            if trafo_loadings
            else 0.0,
        }


def _benchmark_contingencies(model: NetworkModelInput, limit: int) -> list[dict[str, str]]:
    rows = [
        {"id": f"benchmark-{item['id']}-out", "element_type": "line", "element_id": item["id"]}
        for item in model.branches
    ]
    rows.extend(
        {
            "id": f"benchmark-{item['id']}-out",
            "element_type": "transformer",
            "element_id": item["id"],
        }
        for item in model.transformers
    )
    return rows[:limit]


def _comparison(
    model: NetworkModelInput,
    *,
    tolerance_mw: float,
    maximum_capacity_mw: float,
) -> dict[str, Any]:
    settings = {
        "capacity_tolerance_mw": tolerance_mw,
        "maximum_capacity_mw": maximum_capacity_mw,
        "incremental_load_power_factor": 0.96,
    }
    production = PandapowerProvider(**settings)
    reference = IwamotoReferenceProvider(**settings)
    production_base = production.run_base_case(model)
    reference_base = reference.run_base_case(model)
    production_capacity = production.calculate_import_capacity(model)
    reference_capacity = reference.calculate_import_capacity(model)
    prod_n0_mw = float(production_capacity.values["base_case_capacity_mw"])
    ref_n0_mw = float(reference_capacity.values["base_case_capacity_mw"])
    prod_firm_mw = float(production_capacity.values["firm_import_capacity_mw"])
    ref_firm_mw = float(reference_capacity.values["firm_import_capacity_mw"])
    n0_capacity_delta = abs(prod_n0_mw - ref_n0_mw)
    firm_capacity_delta = abs(prod_firm_mw - ref_firm_mw)
    voltage_delta = max(
        abs(
            float(production_base.values[key]) - float(reference_base.values[key])
        )
        for key in ("minimum_voltage_pu", "maximum_voltage_pu")
    )
    binding_case_match = (
        production_capacity.values["binding_case"]
        == reference_capacity.values["binding_case"]
    )
    binding_constraint_match = (
        production_capacity.values["binding_constraint"]
        == reference_capacity.values["binding_constraint"]
    )
    passed = (
        bool(production_base.values.get("passes"))
        and bool(reference_base.values.get("passes"))
        and n0_capacity_delta <= tolerance_mw
        and firm_capacity_delta <= tolerance_mw
        and voltage_delta <= 1e-4
        and binding_case_match
        and binding_constraint_match
    )
    return {
        "model_id": model.model_id,
        "connection_bus": model.connection_bus,
        "contingency_count": len(model.contingencies),
        "production": {
            "algorithm": "newton_raphson",
            "n0_import_mw": prod_n0_mw,
            "firm_import_mw": prod_firm_mw,
            "binding_case": production_capacity.values["binding_case"],
            "binding_constraint": production_capacity.values["binding_constraint"],
            "base_minimum_voltage_pu": production_base.values["minimum_voltage_pu"],
            "base_maximum_voltage_pu": production_base.values["maximum_voltage_pu"],
        },
        "reference": {
            "algorithm": "iwamoto_newton_raphson",
            "n0_import_mw": ref_n0_mw,
            "firm_import_mw": ref_firm_mw,
            "binding_case": reference_capacity.values["binding_case"],
            "binding_constraint": reference_capacity.values["binding_constraint"],
            "base_minimum_voltage_pu": reference_base.values["minimum_voltage_pu"],
            "base_maximum_voltage_pu": reference_base.values["maximum_voltage_pu"],
        },
        "metrics": {
            "n0_absolute_capacity_error_mw": round(n0_capacity_delta, 6),
            "firm_absolute_capacity_error_mw": round(firm_capacity_delta, 6),
            "maximum_base_voltage_error_pu": round(voltage_delta, 8),
            "binding_case_match": binding_case_match,
            "binding_constraint_match": binding_constraint_match,
        },
        "passed": passed,
    }


def build_benchmark_a_artifact(
    output: Path,
    *,
    codes: tuple[str, ...] = DEFAULT_CODES,
    contingency_limit: int = 2,
    tolerance_mw: float = 0.1,
    maximum_capacity_mw: float = 25.0,
) -> dict[str, Any]:
    if not codes or contingency_limit < 0 or tolerance_mw <= 0 or maximum_capacity_mw <= 0:
        raise ValueError("Benchmark A inputs are invalid.")
    cases = []
    model_hashes = {}
    for code in codes:
        model = import_simbench_model(code)
        model = replace(model, contingencies=_benchmark_contingencies(model, contingency_limit))
        model_hashes[code] = hashlib.sha256(
            json.dumps(asdict(model), sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        cases.append(
            _comparison(
                model,
                tolerance_mw=tolerance_mw,
                maximum_capacity_mw=maximum_capacity_mw,
            )
        )
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "AC base-state, nodal import-capacity and bounded N-1 consistency benchmark",
        "validation_class": "open_benchmark",
        "capacity_claim": False,
        "reference_method": {
            "engine": "pandapower",
            "algorithm": "iwamoto_nr",
            "independence": "alternate_algorithm_same_engine",
            "external_solver_validated": False,
            "limitation": "Does not replace future PowerModels.jl or MATPOWER cross-engine validation.",
        },
        "thresholds": {
            "n0_capacity_absolute_error_mw": tolerance_mw,
            "firm_capacity_absolute_error_mw": tolerance_mw,
            "base_voltage_absolute_error_pu": 1e-4,
            "binding_case_match_required": True,
            "binding_constraint_match_required": True,
        },
        "settings": {
            "simbench_codes": list(codes),
            "contingency_limit_per_model": contingency_limit,
            "capacity_tolerance_mw": tolerance_mw,
            "maximum_capacity_mw": maximum_capacity_mw,
            "incremental_load_power_factor": 0.96,
        },
        "model_sha256": model_hashes,
        "cases": cases,
        "summary": {
            "case_count": len(cases),
            "passed_count": sum(bool(case["passed"]) for case in cases),
            "failed_count": sum(not bool(case["passed"]) for case in cases),
            "all_passed": all(bool(case["passed"]) for case in cases),
        },
    }
    artifact["benchmark_sha256"] = hashlib.sha256(
        json.dumps(
            {key: value for key, value in artifact.items() if key not in {"generated_at"}},
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
