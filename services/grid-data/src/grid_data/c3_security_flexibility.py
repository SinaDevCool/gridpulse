"""Release C3 security, flexibility and flexible-connection calculations.

The optimisation is deterministic and physics results are supplied by the C1
provider.  Public/benchmark inputs always remain synthetic demonstrations.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Literal

import numpy as np
from scipy.optimize import linprog

from .network_study import NetworkModelInput, NetworkStudyProvider, PandapowerProvider


@dataclass(frozen=True)
class OperatorSecurityCriteria:
    criteria_id: str
    version: str
    minimum_voltage_pu: float = 0.95
    maximum_voltage_pu: float = 1.05
    continuous_loading_percent: float = 100.0
    emergency_loading_percent: float = 100.0
    contingency_policy: Literal["provided_set", "operator_reviewed_n_minus_one"] = "provided_set"
    reviewed_by_operator: bool = False


@dataclass(frozen=True)
class FlexibilityPortfolio:
    battery_power_mw: float = 0.0
    battery_energy_mwh: float = 0.0
    initial_soc_fraction: float = 0.5
    minimum_soc_fraction: float = 0.1
    maximum_soc_fraction: float = 0.9
    charge_efficiency: float = 0.95
    discharge_efficiency: float = 0.95
    flexible_load_mw: float = 0.0
    maximum_flexible_energy_mwh: float = 0.0
    battery_degradation_eur_mwh: float = 5.0
    unserved_energy_eur_mwh: float = 20_000.0
    onsite_curtailment_eur_mwh: float = 1.0


def assess_security(
    model: NetworkModelInput,
    criteria: OperatorSecurityCriteria,
    *,
    provider: NetworkStudyProvider | None = None,
) -> dict[str, Any]:
    if criteria.reviewed_by_operator and model.validation_class not in {
        "operator_reviewed",
        "operator_confirmed",
    }:
        raise ValueError("Operator-reviewed criteria require an operator-reviewed model.")
    solver = provider or PandapowerProvider(
        minimum_voltage_pu=criteria.minimum_voltage_pu,
        maximum_voltage_pu=criteria.maximum_voltage_pu,
        maximum_loading_percent=criteria.continuous_loading_percent,
    )
    base = solver.run_base_case(model)
    contingency = solver.run_contingency_analysis(model)
    import_capacity = solver.calculate_import_capacity(model)
    export_capacity = solver.calculate_export_capacity(model)
    complete_n_minus_one = bool(criteria.reviewed_by_operator) and bool(model.contingencies)
    return {
        "schema_version": "gridpulse-c3-security-v1",
        "validation_class": model.validation_class,
        "criteria": asdict(criteria),
        "base_case": asdict(base),
        "contingency": asdict(contingency),
        "import_capacity": asdict(import_capacity),
        "export_capacity": asdict(export_capacity),
        "contingency_coverage": {
            "assessed_count": len(model.contingencies),
            "operator_approved_complete_set": complete_n_minus_one,
        },
        "representation": (
            "operator security assessment"
            if complete_n_minus_one
            else "benchmark contingency screen — not an operator-approved N-1 study"
        ),
    }


def _validate_series(name: str, values: list[float], length: int | None = None) -> np.ndarray:
    series = np.asarray(values, dtype=float)
    if series.ndim != 1 or len(series) == 0 or not np.all(np.isfinite(series)):
        raise ValueError(f"{name} must be a finite, non-empty hourly series.")
    if length is not None and len(series) != length:
        raise ValueError(f"{name} must contain {length} values.")
    if np.any(series < 0):
        raise ValueError(f"{name} cannot contain negative values.")
    return series


def optimize_flexibility(
    *,
    timestamps: list[str],
    demand_mw: list[float],
    onsite_generation_mw: list[float],
    import_envelope_mw: list[float],
    export_envelope_mw: list[float],
    price_eur_mwh: list[float],
    portfolio: FlexibilityPortfolio,
    interval_hours: float = 1.0,
) -> dict[str, Any]:
    """Min-cost dispatch under independent import/export envelopes.

    Variables per hour are import, export, charge, discharge, load reduction,
    onsite curtailment, unserved energy and SOC. The LP has no binary exclusivity;
    positive degradation plus import/export netting discourages simultaneous cycling.
    """
    n = len(timestamps)
    demand = _validate_series("demand_mw", demand_mw, n)
    onsite = _validate_series("onsite_generation_mw", onsite_generation_mw, n)
    import_limit = _validate_series("import_envelope_mw", import_envelope_mw, n)
    export_limit = _validate_series("export_envelope_mw", export_envelope_mw, n)
    prices = np.asarray(price_eur_mwh, dtype=float)
    if len(prices) != n or not np.all(np.isfinite(prices)):
        raise ValueError("price_eur_mwh must match the hourly timeline.")
    if interval_hours <= 0:
        raise ValueError("interval_hours must be positive.")
    _validate_portfolio(portfolio)

    width = 8
    size = n * width
    imp, exp, charge, discharge, flex, curtail, unserved, soc = range(width)
    c = np.zeros(size)
    for t in range(n):
        offset = t * width
        c[offset + imp] = prices[t] * interval_hours
        c[offset + exp] = -prices[t] * interval_hours
        c[offset + charge] = portfolio.battery_degradation_eur_mwh * interval_hours
        c[offset + discharge] = portfolio.battery_degradation_eur_mwh * interval_hours
        c[offset + curtail] = portfolio.onsite_curtailment_eur_mwh * interval_hours
        c[offset + unserved] = portfolio.unserved_energy_eur_mwh * interval_hours

    equalities: list[np.ndarray] = []
    rhs: list[float] = []
    for t in range(n):
        row = np.zeros(size)
        offset = t * width
        row[offset + imp] = 1
        row[offset + exp] = -1
        row[offset + charge] = -1
        row[offset + discharge] = 1
        row[offset + flex] = 1
        row[offset + curtail] = -1
        row[offset + unserved] = 1
        equalities.append(row)
        rhs.append(float(demand[t] - onsite[t]))

        storage = np.zeros(size)
        storage[offset + soc] = 1
        if t:
            storage[(t - 1) * width + soc] = -1
            storage[offset + charge] = -portfolio.charge_efficiency * interval_hours
            storage[offset + discharge] = interval_hours / portfolio.discharge_efficiency
            storage_rhs = 0.0
        else:
            storage[offset + charge] = -portfolio.charge_efficiency * interval_hours
            storage[offset + discharge] = interval_hours / portfolio.discharge_efficiency
            storage_rhs = portfolio.initial_soc_fraction * portfolio.battery_energy_mwh
        equalities.append(storage)
        rhs.append(storage_rhs)

    # End with at least the initial SOC, avoiding one-off depletion in annual comparisons.
    inequalities: list[np.ndarray] = []
    upper_rhs: list[float] = []
    final_soc = np.zeros(size)
    final_soc[(n - 1) * width + soc] = -1
    inequalities.append(final_soc)
    upper_rhs.append(-portfolio.initial_soc_fraction * portfolio.battery_energy_mwh)
    if portfolio.maximum_flexible_energy_mwh > 0:
        total_flex = np.zeros(size)
        for t in range(n):
            total_flex[t * width + flex] = interval_hours
        inequalities.append(total_flex)
        upper_rhs.append(portfolio.maximum_flexible_energy_mwh)

    bounds = []
    minimum_soc = portfolio.minimum_soc_fraction * portfolio.battery_energy_mwh
    maximum_soc = portfolio.maximum_soc_fraction * portfolio.battery_energy_mwh
    for t in range(n):
        bounds.extend(
            [
                (0, float(import_limit[t])),
                (0, float(export_limit[t])),
                (0, portfolio.battery_power_mw),
                (0, portfolio.battery_power_mw),
                (0, min(portfolio.flexible_load_mw, float(demand[t]))),
                (0, float(onsite[t])),
                (0, float(demand[t])),
                (minimum_soc, maximum_soc),
            ]
        )
    result = linprog(
        c,
        A_ub=np.asarray(inequalities),
        b_ub=np.asarray(upper_rhs),
        A_eq=np.asarray(equalities),
        b_eq=np.asarray(rhs),
        bounds=bounds,
        method="highs",
    )
    if not result.success:
        raise RuntimeError(f"Flexibility optimisation failed: {result.message}")
    x = result.x.reshape((n, width))
    hourly = []
    for t, timestamp in enumerate(timestamps):
        hourly.append(
            {
                "timestamp": timestamp,
                "demand_mw": round(float(demand[t]), 5),
                "onsite_generation_mw": round(float(onsite[t]), 5),
                "import_limit_mw": round(float(import_limit[t]), 5),
                "export_limit_mw": round(float(export_limit[t]), 5),
                "grid_import_mw": round(float(x[t, imp]), 5),
                "grid_export_mw": round(float(x[t, exp]), 5),
                "battery_charge_mw": round(float(x[t, charge]), 5),
                "battery_discharge_mw": round(float(x[t, discharge]), 5),
                "battery_soc_mwh": round(float(x[t, soc]), 5),
                "flexible_load_reduction_mw": round(float(x[t, flex]), 5),
                "onsite_curtailment_mw": round(float(x[t, curtail]), 5),
                "unserved_load_mw": round(float(x[t, unserved]), 5),
            }
        )
    constrained = import_limit + onsite < demand - 1e-6
    unserved_energy_mwh = float(x[:, unserved].sum() * interval_hours)
    simultaneous_cycle_hours = int(
        np.count_nonzero((x[:, charge] > 1e-6) & (x[:, discharge] > 1e-6))
    )
    maximum_balance_error = 0.0
    for t in range(n):
        supplied = x[t, imp] - x[t, exp] - x[t, charge] + x[t, discharge]
        supplied += x[t, flex] - x[t, curtail] + x[t, unserved] + onsite[t]
        maximum_balance_error = max(maximum_balance_error, abs(float(supplied - demand[t])))
    return {
        "schema_version": "gridpulse-c3-flexibility-v2",
        "solver": "scipy-highs-linear-program",
        "classification": "customer_side_flexibility_planning",
        "feasibility": "serves_all_load"
        if unserved_energy_mwh <= 1e-6
        else "unserved_energy_required",
        "portfolio": asdict(portfolio),
        "summary": {
            "objective_eur": round(float(result.fun), 2),
            "constrained_hours": int(np.count_nonzero(constrained)),
            "load_reduced_mwh": round(float(x[:, flex].sum() * interval_hours), 3),
            "onsite_curtailed_mwh": round(float(x[:, curtail].sum() * interval_hours), 3),
            "unserved_energy_mwh": round(unserved_energy_mwh, 6),
            "battery_throughput_mwh": round(
                float((x[:, charge] + x[:, discharge]).sum() * interval_hours), 3
            ),
            "grid_import_mwh": round(float(x[:, imp].sum() * interval_hours), 3),
            "grid_export_mwh": round(float(x[:, exp].sum() * interval_hours), 3),
            "minimum_import_envelope_mw": round(float(np.min(import_limit)), 3),
            "maximum_import_envelope_mw": round(float(np.max(import_limit)), 3),
            "maximum_power_balance_error_mw": round(maximum_balance_error, 9),
            "simultaneous_charge_discharge_hours": simultaneous_cycle_hours,
        },
        "hourly": hourly,
        "limitations": [
            "Dispatch uses a linear planning model, not real-time control.",
            "Import/export and battery direction are continuous LP decisions without binary exclusivity.",
            "Connection limits remain subject to network-operator agreement and validation.",
        ],
    }


def _validate_portfolio(portfolio: FlexibilityPortfolio) -> None:
    numeric = asdict(portfolio)
    fraction_keys = {"initial_soc_fraction", "minimum_soc_fraction", "maximum_soc_fraction"}
    if any(float(value) < 0 for key, value in numeric.items() if key not in fraction_keys):
        raise ValueError("Portfolio power, energy and cost inputs cannot be negative.")
    if portfolio.battery_power_mw > 0 and portfolio.battery_energy_mwh <= 0:
        raise ValueError("Battery energy must be positive when battery power is declared.")
    if not (
        0
        <= portfolio.minimum_soc_fraction
        <= portfolio.initial_soc_fraction
        <= portfolio.maximum_soc_fraction
        <= 1
    ):
        raise ValueError("Battery SOC fractions must be ordered between zero and one.")
    if not (0 < portfolio.charge_efficiency <= 1 and 0 < portfolio.discharge_efficiency <= 1):
        raise ValueError("Battery efficiencies must be greater than zero and at most one.")


def build_fca_proposal(
    timestamps: list[str],
    dynamic_import_mw: list[float],
    dynamic_export_mw: list[float],
    *,
    contract_start: str,
    contract_end: str,
    mode: Literal["dynamic", "static"] = "dynamic",
) -> dict[str, Any]:
    """Create a non-binding §17(2b) EnWG proposal with auditable limit periods."""
    n = len(timestamps)
    imports = _validate_series("dynamic_import_mw", dynamic_import_mw, n)
    exports = _validate_series("dynamic_export_mw", dynamic_export_mw, n)
    if mode == "static":
        # Conservative month/hour blocks preserve useful time differentiation.
        groups: dict[tuple[int, int], list[int]] = {}
        for index, value in enumerate(timestamps):
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            groups.setdefault((dt.month, dt.hour), []).append(index)
        static_imports = imports.copy()
        static_exports = exports.copy()
        for indices in groups.values():
            static_imports[indices] = float(np.min(imports[indices]))
            static_exports[indices] = float(np.min(exports[indices]))
        imports, exports = static_imports, static_exports
    periods = [
        {
            "timestamp": timestamp,
            "maximum_import_mw": round(float(imports[index]), 5),
            "maximum_export_mw": round(float(exports[index]), 5),
        }
        for index, timestamp in enumerate(timestamps)
    ]
    digest = hashlib.sha256(json.dumps(periods, sort_keys=True).encode()).hexdigest()
    return {
        "schema_version": "gridpulse-c3-fca-proposal-v1",
        "legal_basis": "EnWG §17(2b)",
        "status": "non_binding_operator_contract_proposal",
        "limit_mode": mode,
        "duration": {"start": contract_start, "end": contract_end},
        "limits": periods,
        "technical_requirements": [
            "metered active-power import and export at the agreed connection point",
            "operator communication/control interface to be specified",
            "fail-safe response and availability requirements to be specified",
        ],
        "liability": "must be specified in the signed network-operator agreement",
        "operator_confirmation_required": True,
        "limits_sha256": digest,
    }


def run_c3_assessment(payload: dict[str, Any]) -> dict[str, Any]:
    model = NetworkModelInput(**payload["network_model"])
    criteria = OperatorSecurityCriteria(**payload["security_criteria"])
    portfolio = FlexibilityPortfolio(**payload["portfolio"])
    security = assess_security(model, criteria)
    dispatch = optimize_flexibility(
        timestamps=payload["timestamps"],
        demand_mw=payload["demand_mw"],
        onsite_generation_mw=payload["onsite_generation_mw"],
        import_envelope_mw=payload["import_envelope_mw"],
        export_envelope_mw=payload["export_envelope_mw"],
        price_eur_mwh=payload["price_eur_mwh"],
        portfolio=portfolio,
    )
    fca = build_fca_proposal(
        payload["timestamps"],
        payload["import_envelope_mw"],
        payload["export_envelope_mw"],
        contract_start=payload["contract_start"],
        contract_end=payload["contract_end"],
        mode=payload.get("fca_mode", "dynamic"),
    )
    return {
        "schema_version": "gridpulse-c3-assessment-v1",
        "validation_class": model.validation_class,
        "security": security,
        "flexibility": dispatch,
        "fca": fca,
    }
