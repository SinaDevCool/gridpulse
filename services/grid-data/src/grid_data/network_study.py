"""Release C1 AC network studies with fail-closed provenance.

Electrical studies are produced only from explicitly parameterised networks. Open
benchmark models are classified as ``synthetic_demonstration``; operator models
must be reviewed before their validation class can be promoted.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass, field
from importlib.metadata import version
from typing import Any, ClassVar, Literal, Protocol

ValidationClass = Literal[
    "public_screening",
    "synthetic_demonstration",
    "operator_model_unvalidated",
    "operator_model_reconciled",
    "operator_reviewed",
    "operator_confirmed",
]


@dataclass(frozen=True)
class NetworkModelInput:
    buses: list[dict[str, Any]]
    branches: list[dict[str, Any]]
    transformers: list[dict[str, Any]]
    loads: list[dict[str, Any]]
    generators: list[dict[str, Any]]
    switches: list[dict[str, Any]]
    contingencies: list[dict[str, Any]]
    connection_bus: str
    study_year: int
    provenance: dict[str, Any]
    model_id: str = "unidentified-model"
    model_version: str = "unversioned"
    validation_class: ValidationClass = "operator_model_unvalidated"


@dataclass(frozen=True)
class StudyResult:
    status: Literal["validated_result", "unavailable", "demonstration"]
    study_type: Literal["base_case", "contingency", "voltage", "capacity", "export_capacity"]
    provider: str
    solver_version: str | None = None
    converged: bool | None = None
    values: dict[str, Any] = field(default_factory=dict)
    limitations: list[str] = field(default_factory=list)


class NetworkStudyProvider(Protocol):
    def run_base_case(self, model: NetworkModelInput) -> StudyResult: ...
    def run_contingency_analysis(self, model: NetworkModelInput) -> StudyResult: ...
    def run_voltage_assessment(self, model: NetworkModelInput) -> StudyResult: ...
    def calculate_import_capacity(self, model: NetworkModelInput) -> StudyResult: ...
    def calculate_export_capacity(self, model: NetworkModelInput) -> StudyResult: ...


class UnavailableOperatorStudyProvider:
    _limitations: ClassVar[list[str]] = [
        "Operator or validated planning topology is required.",
        "Impedances, ratings, loading cases, switch state and contingencies are required.",
        "No capacity, N-0, N-1, voltage or security result can be produced.",
    ]

    def _result(self, study_type: Literal["base_case", "contingency", "voltage", "capacity"]):
        return StudyResult(
            status="unavailable",
            study_type=study_type,
            provider="operator-study-unavailable",
            limitations=self._limitations,
        )

    def run_base_case(self, _model: NetworkModelInput) -> StudyResult:
        return self._result("base_case")

    def run_contingency_analysis(self, _model: NetworkModelInput) -> StudyResult:
        return self._result("contingency")

    def run_voltage_assessment(self, _model: NetworkModelInput) -> StudyResult:
        return self._result("voltage")

    def calculate_import_capacity(self, _model: NetworkModelInput) -> StudyResult:
        return self._result("capacity")

    def calculate_export_capacity(self, _model: NetworkModelInput) -> StudyResult:
        return StudyResult(
            status="unavailable",
            study_type="export_capacity",
            provider="operator-study-unavailable",
            limitations=self._limitations,
        )


class PandapowerProvider:
    """Build and solve an explicitly parameterised pandapower network."""

    def __init__(
        self,
        *,
        minimum_voltage_pu: float = 0.95,
        maximum_voltage_pu: float = 1.05,
        maximum_loading_percent: float = 100.0,
        capacity_tolerance_mw: float = 0.1,
        maximum_capacity_mw: float = 2_000.0,
        incremental_load_power_factor: float = 1.0,
    ) -> None:
        try:
            import pandapower as pp  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError("pandapower study extra is not installed") from error
        self._pp = pp
        self._solver_version = version("pandapower")
        self._vmin = minimum_voltage_pu
        self._vmax = maximum_voltage_pu
        self._max_loading = maximum_loading_percent
        self._tolerance = capacity_tolerance_mw
        self._maximum_capacity = maximum_capacity_mw
        if not 0 < incremental_load_power_factor <= 1:
            raise ValueError("Incremental load power factor must be in (0, 1].")
        self._incremental_load_power_factor = incremental_load_power_factor

    @staticmethod
    def _status(model: NetworkModelInput) -> Literal["validated_result", "demonstration"]:
        return (
            "demonstration"
            if model.validation_class in {"public_screening", "synthetic_demonstration"}
            else "validated_result"
        )

    def _build_network(self, model: NetworkModelInput):
        if not model.provenance.get("source_url") or not model.provenance.get("license"):
            raise ValueError("Model provenance requires source_url and license.")
        pp = self._pp
        net = pp.create_empty_network(name=model.model_id)
        bus_indices: dict[str, int] = {}
        for bus in model.buses:
            bus_id = str(bus["id"])
            bus_indices[bus_id] = pp.create_bus(
                net,
                vn_kv=float(bus["vn_kv"]),
                name=str(bus.get("name", bus_id)),
                min_vm_pu=float(bus.get("min_vm_pu", self._vmin)),
                max_vm_pu=float(bus.get("max_vm_pu", self._vmax)),
            )
        if model.connection_bus not in bus_indices:
            raise ValueError("Connection bus does not exist in the network model.")

        line_indices: dict[str, int] = {}
        for branch in model.branches:
            required = (
                "from_bus",
                "to_bus",
                "length_km",
                "r_ohm_per_km",
                "x_ohm_per_km",
                "max_i_ka",
            )
            if any(key not in branch for key in required):
                raise ValueError(
                    f"Branch {branch.get('id', '?')} is missing electrical parameters."
                )
            line_indices[str(branch.get("id", "line"))] = pp.create_line_from_parameters(
                net,
                from_bus=bus_indices[str(branch["from_bus"])],
                to_bus=bus_indices[str(branch["to_bus"])],
                length_km=float(branch["length_km"]),
                r_ohm_per_km=float(branch["r_ohm_per_km"]),
                x_ohm_per_km=float(branch["x_ohm_per_km"]),
                c_nf_per_km=float(branch.get("c_nf_per_km", 0.0)),
                max_i_ka=float(branch["max_i_ka"]),
                name=str(branch.get("id", "line")),
                max_loading_percent=float(branch.get("max_loading_percent", self._max_loading)),
            )

        transformer_indices: dict[str, int] = {}
        for transformer in model.transformers:
            required = (
                "hv_bus",
                "lv_bus",
                "sn_mva",
                "vn_hv_kv",
                "vn_lv_kv",
                "vk_percent",
                "vkr_percent",
            )
            if any(key not in transformer for key in required):
                raise ValueError(f"Transformer {transformer.get('id', '?')} is missing parameters.")
            transformer_indices[str(transformer.get("id", "transformer"))] = (
                pp.create_transformer_from_parameters(
                    net,
                    hv_bus=bus_indices[str(transformer["hv_bus"])],
                    lv_bus=bus_indices[str(transformer["lv_bus"])],
                    sn_mva=float(transformer["sn_mva"]),
                    vn_hv_kv=float(transformer["vn_hv_kv"]),
                    vn_lv_kv=float(transformer["vn_lv_kv"]),
                    vk_percent=float(transformer["vk_percent"]),
                    vkr_percent=float(transformer["vkr_percent"]),
                    pfe_kw=float(transformer.get("pfe_kw", 0.0)),
                    i0_percent=float(transformer.get("i0_percent", 0.0)),
                    shift_degree=float(transformer.get("shift_degree", 0.0)),
                    name=str(transformer.get("id", "transformer")),
                    max_loading_percent=float(
                        transformer.get("max_loading_percent", self._max_loading)
                    ),
                )
            )

        slack_count = 0
        for generator in model.generators:
            bus = bus_indices[str(generator["bus"])]
            if generator.get("slack") or generator.get("kind") == "external_grid":
                pp.create_ext_grid(
                    net,
                    bus=bus,
                    vm_pu=float(generator.get("vm_pu", 1.0)),
                    name=str(generator.get("id", "external-grid")),
                )
                slack_count += 1
            else:
                pp.create_sgen(
                    net,
                    bus=bus,
                    p_mw=float(generator.get("p_mw", 0.0)),
                    q_mvar=float(generator.get("q_mvar", 0.0)),
                    name=str(generator.get("id", "generator")),
                )
        if slack_count != 1:
            raise ValueError("C1 requires exactly one explicit external-grid/slack source.")

        for load in model.loads:
            pp.create_load(
                net,
                bus=bus_indices[str(load["bus"])],
                p_mw=float(load.get("p_mw", 0.0)),
                q_mvar=float(load.get("q_mvar", 0.0)),
                name=str(load.get("id", "load")),
            )
        for switch in model.switches:
            switch_type = str(switch.get("element_type"))
            closed = bool(switch.get("closed", True))
            if switch_type == "line":
                pp.create_switch(
                    net,
                    bus=bus_indices[str(switch["bus"])],
                    element=line_indices[str(switch["element_id"])],
                    et="l",
                    closed=closed,
                )
            elif switch_type == "transformer":
                pp.create_switch(
                    net,
                    bus=bus_indices[str(switch["bus"])],
                    element=transformer_indices[str(switch["element_id"])],
                    et="t",
                    closed=closed,
                )
            elif switch_type == "bus":
                pp.create_switch(
                    net,
                    bus=bus_indices[str(switch["bus"])],
                    element=bus_indices[str(switch["element_id"])],
                    et="b",
                    closed=closed,
                )
        net["_gridpulse_bus_indices"] = bus_indices
        return net

    def _solve(self, net, *, detailed: bool = False) -> dict[str, Any]:
        try:
            self._pp.runpp(
                net,
                algorithm="nr",
                calculate_voltage_angles=True,
                init="auto",
                numba=False,
            )
        except Exception as error:  # noqa: BLE001 - pandapower exposes several solver exceptions
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
        supplied_load_buses = {
            int(bus)
            for bus in net.load.loc[net.load.in_service.astype(bool), "bus"].tolist()
            if int(bus) in net.res_bus.index
            and math.isfinite(float(net.res_bus.at[int(bus), "vm_pu"]))
        }
        active_load_buses = {
            int(bus) for bus in net.load.loc[net.load.in_service.astype(bool), "bus"].tolist()
        }
        if supplied_load_buses != active_load_buses:
            violations.append("unsupplied_load_bus")
        bus_voltage_violations = []
        for bus_index, voltage in net.res_bus.vm_pu.items():
            if not math.isfinite(float(voltage)):
                continue
            minimum = max(self._vmin, float(net.bus.at[bus_index, "min_vm_pu"]))
            maximum = min(self._vmax, float(net.bus.at[bus_index, "max_vm_pu"]))
            if float(voltage) < minimum:
                bus_voltage_violations.append("minimum_bus_voltage")
            if float(voltage) > maximum:
                bus_voltage_violations.append("maximum_bus_voltage")
        if "minimum_bus_voltage" in bus_voltage_violations:
            violations.append("minimum_bus_voltage")
        if "maximum_bus_voltage" in bus_voltage_violations:
            violations.append("maximum_bus_voltage")
        if line_loadings and max(line_loadings) > self._max_loading:
            violations.append("line_thermal_loading")
        if trafo_loadings and max(trafo_loadings) > self._max_loading:
            violations.append("transformer_thermal_loading")
        result = {
            "converged": True,
            "passes": not violations,
            "violations": violations,
            "minimum_voltage_pu": round(min(voltages), 5) if voltages else None,
            "maximum_voltage_pu": round(max(voltages), 5) if voltages else None,
            "maximum_line_loading_percent": round(max(line_loadings), 3) if line_loadings else 0.0,
            "maximum_transformer_loading_percent": round(max(trafo_loadings), 3)
            if trafo_loadings
            else 0.0,
        }
        if detailed:
            result["bus_voltage_pu"] = {
                str(net.bus.at[index, "name"]): round(float(value), 6)
                for index, value in net.res_bus.vm_pu.items()
                if math.isfinite(float(value))
            }
            result["line_loading_percent"] = {
                str(net.line.at[index, "name"]): round(float(value), 6)
                for index, value in net.res_line.loading_percent.items()
                if math.isfinite(float(value))
            }
            result["transformer_loading_percent"] = {
                str(net.trafo.at[index, "name"]): round(float(value), 6)
                for index, value in net.res_trafo.loading_percent.items()
                if math.isfinite(float(value))
            }
        return result

    def _result(self, model: NetworkModelInput, study_type, values: dict[str, Any]) -> StudyResult:
        return StudyResult(
            status=self._status(model),
            study_type=study_type,
            provider="pandapower-newton-raphson",
            solver_version=self._solver_version,
            converged=bool(values.get("converged")),
            values={
                **values,
                "model_id": model.model_id,
                "model_version": model.model_version,
                "validation_class": model.validation_class,
                "study_year": model.study_year,
                "provenance": copy.deepcopy(model.provenance),
            },
            limitations=[
                "C1 evaluates steady-state AC thermal and voltage constraints only.",
                "Short-circuit, protection, harmonics and dynamic stability are outside this result.",
                "Only operator-confirmed studies may be represented as confirmed connection capacity.",
            ],
        )

    def run_base_case(self, model: NetworkModelInput) -> StudyResult:
        return self._result(model, "base_case", self._solve(self._build_network(model)))

    def run_detailed_base_case(self, model: NetworkModelInput) -> StudyResult:
        """Solve one state with per-asset results for bounded audit workloads."""
        return self._result(
            model, "base_case", self._solve(self._build_network(model), detailed=True)
        )

    def run_detailed_contingency_analysis(self, model: NetworkModelInput) -> StudyResult:
        cases = []
        for contingency in model.contingencies:
            net = self._build_network(model)
            self._apply_contingency(net, contingency)
            cases.append({"id": str(contingency["id"]), **self._solve(net, detailed=True)})
        return self._result(
            model,
            "contingency",
            {
                "converged": bool(cases) and all(case["converged"] for case in cases),
                "passes": bool(cases) and all(case.get("passes", False) for case in cases),
                "case_count": len(cases),
                "cases": cases,
            },
        )

    def run_voltage_assessment(self, model: NetworkModelInput) -> StudyResult:
        return self._result(model, "voltage", self._solve(self._build_network(model)))

    def _apply_contingency(self, net, contingency: dict[str, Any]) -> None:
        element_type = str(contingency["element_type"])
        element_id = str(contingency["element_id"])
        table = (
            net.line
            if element_type == "line"
            else net.trafo
            if element_type == "transformer"
            else None
        )
        if table is None:
            raise ValueError(f"Unsupported contingency element type: {element_type}")
        matches = table.index[table.name.astype(str) == element_id].tolist()
        if len(matches) != 1:
            raise ValueError(f"Contingency element {element_id} is not uniquely identified.")
        table.at[matches[0], "in_service"] = False

    def run_contingency_analysis(self, model: NetworkModelInput) -> StudyResult:
        cases = []
        for contingency in model.contingencies:
            net = self._build_network(model)
            self._apply_contingency(net, contingency)
            cases.append({"id": str(contingency["id"]), **self._solve(net)})
        values = {
            "converged": bool(cases) and all(case["converged"] for case in cases),
            "passes": bool(cases) and all(case.get("passes", False) for case in cases),
            "case_count": len(cases),
            "cases": cases,
        }
        if not cases:
            values["reason"] = "No reviewed contingency list was provided."
        return self._result(model, "contingency", values)

    def _capacity_for_case(self, model: NetworkModelInput, contingency: dict[str, Any] | None):
        net = self._build_network(model)
        if contingency:
            self._apply_contingency(net, contingency)
        connection_bus = net["_gridpulse_bus_indices"][model.connection_bus]
        candidate_index = self._pp.create_load(
            net, bus=connection_bus, p_mw=0.0, q_mvar=0.0, name="gridpulse-candidate"
        )
        reactive_ratio = math.tan(math.acos(self._incremental_load_power_factor))

        def feasible(import_mw: float):
            net.load.at[candidate_index, "p_mw"] = import_mw
            net.load.at[candidate_index, "q_mvar"] = import_mw * reactive_ratio
            result = self._solve(net)
            return bool(result.get("passes")), result

        base_passes, base_result = feasible(0.0)
        if not base_passes:
            if contingency is None:
                reason = (base_result.get("violations") or [base_result.get("error", "unknown")])[0]
                raise ValueError(f"Intact base case is infeasible: {reason}")
            failed = base_result.get("violations") or ["non_convergence"]
            return 0.0, {
                **base_result,
                "binding_constraint": failed[0],
                "capacity_is_lower_bound": False,
            }

        lower, upper = 0.0, 1.0
        failed_result: dict[str, Any] = {}
        while upper < self._maximum_capacity:
            passes, result = feasible(upper)
            if not passes:
                failed_result = result
                break
            lower, upper = upper, min(upper * 2, self._maximum_capacity)
            if lower == upper:
                break
        if upper == self._maximum_capacity and feasible(upper)[0]:
            return upper, {
                "binding_constraint": "search_ceiling",
                "capacity_is_lower_bound": True,
                **self._solve(net),
            }
        while upper - lower > self._tolerance:
            midpoint = (lower + upper) / 2
            passes, result = feasible(midpoint)
            if passes:
                lower = midpoint
            else:
                upper = midpoint
                failed_result = result
        _, boundary = feasible(lower)
        failed = failed_result.get("violations") or (
            ["non_convergence"] if failed_result and not failed_result.get("converged") else []
        )
        return round(lower, 3), {
            **boundary,
            "binding_constraint": failed[0] if failed else "numerical_boundary",
            "capacity_is_lower_bound": False,
        }

    def calculate_import_capacity(self, model: NetworkModelInput) -> StudyResult:
        base_capacity, base_boundary = self._capacity_for_case(model, None)
        contingency_results = []
        for contingency in model.contingencies:
            capacity, boundary = self._capacity_for_case(model, contingency)
            contingency_results.append(
                {"id": str(contingency["id"]), "capacity_mw": capacity, **boundary}
            )
        all_limits = [
            ("base_case", base_capacity, base_boundary),
            *[(item["id"], item["capacity_mw"], item) for item in contingency_results],
        ]
        binding_case, firm_capacity, binding = min(all_limits, key=lambda item: item[1])
        values = {
            "converged": True,
            "base_case_capacity_mw": base_capacity,
            "firm_import_capacity_mw": firm_capacity,
            "binding_case": binding_case,
            "binding_constraint": binding.get("binding_constraint"),
            "capacity_is_lower_bound": bool(binding.get("capacity_is_lower_bound")),
            "contingencies": contingency_results,
            "search_tolerance_mw": self._tolerance,
            "voltage_limits_pu": [self._vmin, self._vmax],
            "thermal_limit_percent": self._max_loading,
            "incremental_load_power_factor": self._incremental_load_power_factor,
        }
        return self._result(model, "capacity", values)

    def _export_capacity_for_case(
        self, model: NetworkModelInput, contingency: dict[str, Any] | None
    ):
        net = self._build_network(model)
        if contingency:
            self._apply_contingency(net, contingency)
        connection_bus = net["_gridpulse_bus_indices"][model.connection_bus]
        candidate_index = self._pp.create_sgen(
            net, bus=connection_bus, p_mw=0.0, q_mvar=0.0, name="gridpulse-export-candidate"
        )

        def feasible(export_mw: float):
            net.sgen.at[candidate_index, "p_mw"] = export_mw
            result = self._solve(net)
            return bool(result.get("passes")), result

        lower, upper = 0.0, 1.0
        failed_result: dict[str, Any] = {}
        while upper < self._maximum_capacity:
            passes, result = feasible(upper)
            if not passes:
                failed_result = result
                break
            lower, upper = upper, min(upper * 2, self._maximum_capacity)
            if lower == upper:
                break
        if upper == self._maximum_capacity and feasible(upper)[0]:
            return upper, {"binding_constraint": "search_ceiling", **self._solve(net)}
        while upper - lower > self._tolerance:
            midpoint = (lower + upper) / 2
            passes, result = feasible(midpoint)
            if passes:
                lower = midpoint
            else:
                upper = midpoint
                failed_result = result
        _, boundary = feasible(lower)
        failed = failed_result.get("violations") or (
            ["non_convergence"] if failed_result and not failed_result.get("converged") else []
        )
        return round(lower, 3), {
            **boundary,
            "binding_constraint": failed[0] if failed else "numerical_boundary",
        }

    def calculate_export_capacity(self, model: NetworkModelInput) -> StudyResult:
        base_capacity, base_boundary = self._export_capacity_for_case(model, None)
        contingency_results = []
        for contingency in model.contingencies:
            capacity, boundary = self._export_capacity_for_case(model, contingency)
            contingency_results.append(
                {"id": str(contingency["id"]), "capacity_mw": capacity, **boundary}
            )
        limits = [
            ("base_case", base_capacity, base_boundary),
            *[(item["id"], item["capacity_mw"], item) for item in contingency_results],
        ]
        binding_case, export_capacity, binding = min(limits, key=lambda item: item[1])
        return self._result(
            model,
            "export_capacity",
            {
                "converged": True,
                "base_case_export_capacity_mw": base_capacity,
                "firm_export_capacity_mw": export_capacity,
                "binding_case": binding_case,
                "binding_constraint": binding.get("binding_constraint"),
                "contingencies": contingency_results,
                "search_tolerance_mw": self._tolerance,
                "voltage_limits_pu": [self._vmin, self._vmax],
                "thermal_limit_percent": self._max_loading,
            },
        )
