"""Benchmark B: external-engine AC capacity validation with PYPOWER."""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, replace
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from typing import Any

from .benchmark_a import DEFAULT_CODES, _benchmark_contingencies
from .benchmark_model import import_simbench_model
from .network_study import NetworkModelInput, PandapowerProvider

SCHEMA_VERSION = "gridpulse-benchmark-b-v1"


class PypowerReferenceProvider(PandapowerProvider):
    """Run a shared pandapower case conversion through standalone PYPOWER."""

    def __init__(self, **settings: Any) -> None:
        super().__init__(**settings)
        try:
            from pandapower.converter.pypower.to_ppc import to_ppc
            from pypower.api import ppoption, runpf
        except ImportError as error:
            raise RuntimeError("Benchmark B requires the pypower study dependency.") from error
        self._to_ppc = to_ppc
        self._ppoption = ppoption
        self._runpf = runpf
        self.reference_solver_version = version("pypower")

    def _solve(self, net) -> dict[str, Any]:
        try:
            ppc = self._to_ppc(
                net,
                calculate_voltage_angles=True,
                check_connectivity=True,
                init="flat",
            )
            result, success = self._runpf(
                ppc,
                self._ppoption(
                    VERBOSE=0,
                    OUT_ALL=0,
                    PF_ALG=2,
                    PF_MAX_IT_FD=100,
                ),
            )
        except Exception as error:  # noqa: BLE001
            return {"converged": False, "error": type(error).__name__}
        if not success:
            return {"converged": False, "error": "PypowerDidNotConverge"}

        from pypower.idx_brch import BR_STATUS, PF, PT, QF, QT
        from pypower.idx_bus import BASE_KV, BUS_I, BUS_TYPE, NONE, VM

        bus_rows = {
            int(row[BUS_I]): row for row in result["bus"] if int(row[BUS_TYPE]) != NONE
        }
        lookup = net["_pd2ppc_lookups"]["bus"]
        isolated = {int(index) for index in net.get("_isolated_buses", [])}
        active_load_buses = {
            int(bus) for bus in net.load.loc[net.load.in_service.astype(bool), "bus"].tolist()
        }
        violations: list[str] = []
        if active_load_buses & isolated:
            violations.append("unsupplied_load_bus")

        voltages = []
        for bus_index, bus in net.bus.iterrows():
            ppc_index = int(lookup[int(bus_index)])
            row = bus_rows.get(ppc_index)
            if row is None or not math.isfinite(float(row[VM])):
                continue
            voltage = float(row[VM])
            voltages.append(voltage)
            minimum = max(self._vmin, float(bus["min_vm_pu"]))
            maximum = min(self._vmax, float(bus["max_vm_pu"]))
            if voltage < minimum and "minimum_bus_voltage" not in violations:
                violations.append("minimum_bus_voltage")
            if voltage > maximum and "maximum_bus_voltage" not in violations:
                violations.append("maximum_bus_voltage")

        branch_lookup = net["_pd2ppc_lookups"]["branch"]
        line_start, line_end = branch_lookup.get("line", (0, 0))
        line_loadings = []
        for offset, branch_row in enumerate(result["branch"][line_start:line_end]):
            line = net.line.iloc[offset]
            if not bool(line["in_service"]) or not bool(branch_row[BR_STATUS]):
                continue
            from_bus = bus_rows.get(int(branch_row[0]))
            to_bus = bus_rows.get(int(branch_row[1]))
            if from_bus is None or to_bus is None:
                continue
            from_rating = (
                math.sqrt(3)
                * float(from_bus[BASE_KV])
                * float(from_bus[VM])
                * float(line["max_i_ka"])
                * float(line["df"])
                * float(line["parallel"])
            )
            to_rating = (
                math.sqrt(3)
                * float(to_bus[BASE_KV])
                * float(to_bus[VM])
                * float(line["max_i_ka"])
                * float(line["df"])
                * float(line["parallel"])
            )
            from_mva = math.hypot(float(branch_row[PF]), float(branch_row[QF]))
            to_mva = math.hypot(float(branch_row[PT]), float(branch_row[QT]))
            line_loadings.append(100 * max(from_mva / from_rating, to_mva / to_rating))

        trafo_start, trafo_end = branch_lookup.get("trafo", (0, 0))
        trafo_loadings = []
        for offset, branch_row in enumerate(result["branch"][trafo_start:trafo_end]):
            trafo = net.trafo.iloc[offset]
            if not bool(trafo["in_service"]) or not bool(branch_row[BR_STATUS]):
                continue
            rating = float(trafo["sn_mva"]) * float(trafo["parallel"]) * float(trafo["df"])
            from_mva = math.hypot(float(branch_row[PF]), float(branch_row[QF]))
            to_mva = math.hypot(float(branch_row[PT]), float(branch_row[QT]))
            from_bus = bus_rows[int(branch_row[0])]
            to_bus = bus_rows[int(branch_row[1])]
            # pandapower's default transformer loading is current-based. Compare
            # actual side current with rated side current, including tap/voltage.
            from_loading = (
                from_mva
                * float(trafo["vn_hv_kv"])
                / (rating * float(from_bus[BASE_KV]) * float(from_bus[VM]))
            )
            to_loading = (
                to_mva
                * float(trafo["vn_lv_kv"])
                / (rating * float(to_bus[BASE_KV]) * float(to_bus[VM]))
            )
            trafo_loadings.append(100 * max(from_loading, to_loading))

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


def _comparison(
    model: NetworkModelInput,
    *,
    tolerance_mw: float,
    voltage_tolerance_pu: float,
    loading_tolerance_percent: float,
    maximum_capacity_mw: float,
) -> dict[str, Any]:
    settings = {
        "capacity_tolerance_mw": tolerance_mw,
        "maximum_capacity_mw": maximum_capacity_mw,
        "incremental_load_power_factor": 0.96,
    }
    production = PandapowerProvider(**settings)
    reference = PypowerReferenceProvider(**settings)
    prod_base = production.run_base_case(model).values
    ref_base = reference.run_base_case(model).values
    prod_capacity = production.calculate_import_capacity(model).values
    ref_capacity = reference.calculate_import_capacity(model).values

    metrics = {
        "n0_absolute_capacity_error_mw": round(
            abs(prod_capacity["base_case_capacity_mw"] - ref_capacity["base_case_capacity_mw"]),
            6,
        ),
        "firm_absolute_capacity_error_mw": round(
            abs(
                prod_capacity["firm_import_capacity_mw"]
                - ref_capacity["firm_import_capacity_mw"]
            ),
            6,
        ),
        "minimum_voltage_error_pu": round(
            abs(prod_base["minimum_voltage_pu"] - ref_base["minimum_voltage_pu"]), 8
        ),
        "maximum_voltage_error_pu": round(
            abs(prod_base["maximum_voltage_pu"] - ref_base["maximum_voltage_pu"]), 8
        ),
        "line_loading_error_percent": round(
            abs(
                prod_base["maximum_line_loading_percent"]
                - ref_base["maximum_line_loading_percent"]
            ),
            6,
        ),
        "transformer_loading_error_percent": round(
            abs(
                prod_base["maximum_transformer_loading_percent"]
                - ref_base["maximum_transformer_loading_percent"]
            ),
            6,
        ),
        "binding_case_match": prod_capacity["binding_case"] == ref_capacity["binding_case"],
        "binding_constraint_match": (
            prod_capacity["binding_constraint"] == ref_capacity["binding_constraint"]
        ),
    }
    passed = (
        bool(prod_base.get("passes"))
        and bool(ref_base.get("passes"))
        and metrics["n0_absolute_capacity_error_mw"] <= tolerance_mw
        and metrics["firm_absolute_capacity_error_mw"] <= tolerance_mw
        and metrics["minimum_voltage_error_pu"] <= voltage_tolerance_pu
        and metrics["maximum_voltage_error_pu"] <= voltage_tolerance_pu
        and metrics["line_loading_error_percent"] <= loading_tolerance_percent
        and metrics["transformer_loading_error_percent"] <= loading_tolerance_percent
        and metrics["binding_case_match"]
        and metrics["binding_constraint_match"]
    )
    return {
        "model_id": model.model_id,
        "connection_bus": model.connection_bus,
        "contingency_count": len(model.contingencies),
        "production": {
            "engine": "pandapower",
            "algorithm": "newton_raphson",
            "n0_import_mw": prod_capacity["base_case_capacity_mw"],
            "firm_import_mw": prod_capacity["firm_import_capacity_mw"],
            "binding_case": prod_capacity["binding_case"],
            "binding_constraint": prod_capacity["binding_constraint"],
            "base": prod_base,
        },
        "reference": {
            "engine": "pypower",
            "version": reference.reference_solver_version,
            "algorithm": "fast_decoupled_xb",
            "n0_import_mw": ref_capacity["base_case_capacity_mw"],
            "firm_import_mw": ref_capacity["firm_import_capacity_mw"],
            "binding_case": ref_capacity["binding_case"],
            "binding_constraint": ref_capacity["binding_constraint"],
            "base": ref_base,
        },
        "metrics": metrics,
        "passed": passed,
    }


def build_benchmark_b_artifact(
    output: Path,
    *,
    codes: tuple[str, ...] = DEFAULT_CODES,
    contingency_limit: int = 2,
    tolerance_mw: float = 0.1,
    voltage_tolerance_pu: float = 1e-4,
    loading_tolerance_percent: float = 0.1,
    maximum_capacity_mw: float = 25.0,
) -> dict[str, Any]:
    values = (
        contingency_limit,
        tolerance_mw,
        voltage_tolerance_pu,
        loading_tolerance_percent,
        maximum_capacity_mw,
    )
    if not codes or values[0] < 0 or any(value <= 0 for value in values[1:]):
        raise ValueError("Benchmark B inputs are invalid.")
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
                voltage_tolerance_pu=voltage_tolerance_pu,
                loading_tolerance_percent=loading_tolerance_percent,
                maximum_capacity_mw=maximum_capacity_mw,
            )
        )
    all_passed = all(bool(case["passed"]) for case in cases)
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Independent-engine AC base-state and capacity validation",
        "validation_class": "open_benchmark",
        "capacity_claim": False,
        "reference_method": {
            "engine": "pypower",
            "algorithm": "fast_decoupled_xb",
            "independence": "independent_solver_shared_pandapower_case_conversion",
            "external_solver_validated": all_passed,
            "limitation": (
                "Validates the AC solver/search boundary, not an independent model conversion, "
                "operator model, or measured grid headroom."
            ),
        },
        "thresholds": {
            "n0_capacity_absolute_error_mw": tolerance_mw,
            "firm_capacity_absolute_error_mw": tolerance_mw,
            "voltage_absolute_error_pu": voltage_tolerance_pu,
            "loading_absolute_error_percent": loading_tolerance_percent,
            "binding_case_match_required": True,
            "binding_constraint_match_required": True,
        },
        "settings": {
            "simbench_codes": list(codes),
            "contingency_limit_per_model": contingency_limit,
            "maximum_capacity_mw": maximum_capacity_mw,
            "incremental_load_power_factor": 0.96,
        },
        "model_sha256": model_hashes,
        "cases": cases,
        "summary": {
            "case_count": len(cases),
            "passed_count": sum(bool(case["passed"]) for case in cases),
            "failed_count": sum(not bool(case["passed"]) for case in cases),
            "all_passed": all_passed,
        },
    }
    artifact["benchmark_sha256"] = hashlib.sha256(
        json.dumps(
            {key: value for key, value in artifact.items() if key != "generated_at"},
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
