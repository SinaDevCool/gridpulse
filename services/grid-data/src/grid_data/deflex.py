"""Deterministic DeFlex-style dispatch against supplied hourly import envelopes."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class FlexibilityPolicy:
    interruptible_fraction: float
    maximum_interruption_hours: int
    annual_constrained_hour_budget: int
    recovery_hours: int
    battery_power_mw: float
    battery_energy_mwh: float
    charge_efficiency: float = 0.92
    discharge_efficiency: float = 0.92
    minimum_reserve_soc_fraction: float = 0.10
    ramp_limit_mw_per_hour: float | None = None
    backup_generation_mw: float = 0.0
    critical_load_fraction: float = 0.80
    workload_deadline_hours: int = 24
    battery_degradation_cost_per_mwh: float = 0.0

    def validate(self) -> None:
        if not 0 <= self.interruptible_fraction <= 1:
            raise ValueError("interruptible fraction must be between zero and one")
        if min(self.maximum_interruption_hours, self.annual_constrained_hour_budget,
               self.recovery_hours) < 0:
            raise ValueError("duration and hour budgets must be non-negative")
        if min(self.battery_power_mw, self.battery_energy_mwh, self.backup_generation_mw) < 0:
            raise ValueError("power and energy values must be non-negative")
        if not 0 < self.charge_efficiency <= 1 or not 0 < self.discharge_efficiency <= 1:
            raise ValueError("battery efficiencies must be in (0, 1]")
        if not 0 <= self.minimum_reserve_soc_fraction <= 1:
            raise ValueError("minimum reserve state of charge must be between zero and one")
        if not 0 <= self.critical_load_fraction <= 1 or self.workload_deadline_hours < 1:
            raise ValueError("critical load fraction or workload deadline is invalid")
        if self.battery_degradation_cost_per_mwh < 0:
            raise ValueError("battery degradation cost must be non-negative")


def dispatch_flexibility(
    site_load_mw: list[float],
    n0_envelope_mw: list[float],
    n1_envelope_mw: list[float],
    policy: FlexibilityPolicy,
) -> dict[str, object]:
    """Dispatch bounded interruption and storage; never infer an envelope from flexibility."""
    policy.validate()
    if not site_load_mw or not (len(site_load_mw) == len(n0_envelope_mw) == len(n1_envelope_mw)):
        raise ValueError("hourly site load and envelopes must be non-empty and aligned")
    if min(site_load_mw + n0_envelope_mw + n1_envelope_mw) < 0:
        raise ValueError("hourly values must be non-negative")
    minimum_soc = policy.battery_energy_mwh * policy.minimum_reserve_soc_fraction
    soc = policy.battery_energy_mwh
    consecutive = constrained_hours = interruption_hours = max_consecutive = 0
    shifted_mwh = discharged_mwh = charged_mwh = 0.0
    recovery_backlog = 0.0
    backlog_age = deadline_violation_hours = 0
    critical_unserved_mwh = flexible_unserved_mwh = ramp_unserved_mwh = 0.0
    prior_import: float | None = None
    trace: list[dict[str, object]] = []
    for hour, (demand, n0, n1) in enumerate(zip(site_load_mw, n0_envelope_mw, n1_envelope_mw)):
        firm_envelope = min(n0, n1)
        rebound = min(recovery_backlog / max(1, policy.recovery_hours), demand) if recovery_backlog else 0.0
        critical_demand = demand * policy.critical_load_fraction
        flexible_demand = demand - critical_demand
        requested = demand + rebound
        shortage = max(0.0, requested - firm_envelope - policy.backup_generation_mw)
        can_interrupt = interruption_hours < policy.annual_constrained_hour_budget and consecutive < policy.maximum_interruption_hours
        interruption = min(shortage, flexible_demand, demand * policy.interruptible_fraction) if can_interrupt else 0.0
        shortage -= interruption
        recovery_backlog += interruption - rebound
        available_battery = max(0.0, soc - minimum_soc) * policy.discharge_efficiency
        discharge = min(shortage, policy.battery_power_mw, available_battery)
        soc -= discharge / policy.discharge_efficiency
        discharged_mwh += discharge
        raw_import = max(0.0, requested - interruption - discharge - policy.backup_generation_mw)
        room_input = max(0.0, policy.battery_energy_mwh - soc) / policy.charge_efficiency
        charge = min(max(0.0, firm_envelope - raw_import), policy.battery_power_mw, room_input)
        soc += charge * policy.charge_efficiency
        charged_mwh += charge
        grid_import = raw_import + charge
        ramp_shortfall = 0.0
        if policy.ramp_limit_mw_per_hour is not None and prior_import is not None:
            upper = prior_import + policy.ramp_limit_mw_per_hour
            if grid_import > upper:
                reducible_charge = min(charge, grid_import - upper)
                charge -= reducible_charge
                soc -= reducible_charge * policy.charge_efficiency
                charged_mwh -= reducible_charge
                grid_import -= reducible_charge
                ramp_shortfall = max(0.0, grid_import - upper)
                grid_import = min(grid_import, upper)
        network_unmet = max(0.0, raw_import - firm_envelope)
        unmet = network_unmet + ramp_shortfall
        served_site = max(0.0, demand - interruption - unmet)
        critical_unserved = max(0.0, critical_demand - served_site)
        flexible_unserved = max(0.0, unmet - critical_unserved)
        critical_unserved_mwh += critical_unserved
        flexible_unserved_mwh += flexible_unserved
        ramp_unserved_mwh += ramp_shortfall
        consecutive = consecutive + 1 if interruption > 0 else 0
        interruption_hours += int(interruption > 0)
        constrained_hours += int(unmet > 1e-9)
        max_consecutive = max(max_consecutive, consecutive)
        shifted_mwh += interruption
        backlog_age = backlog_age + 1 if recovery_backlog > 1e-9 else 0
        deadline_violation_hours += int(backlog_age > policy.workload_deadline_hours)
        prior_import = grid_import
        trace.append({"hour": hour, "site_demand_mw": demand, "firm_envelope_mw": firm_envelope,
                      "interrupted_mw": interruption, "battery_discharge_mw": discharge,
                      "battery_charge_mw": charge, "rebound_mw": rebound,
                      "grid_import_mw": grid_import, "soc_mwh": soc, "unserved_mw": unmet,
                      "critical_unserved_mw": critical_unserved,
                      "flexible_unserved_mw": flexible_unserved,
                      "ramp_unserved_mw": ramp_shortfall,
                      "recovery_backlog_mwh": recovery_backlog,
                      "n0_binding": n0 <= n1, "n1_binding": n1 < n0})
    unsafe = [row for row in trace if float(row["grid_import_mw"]) > float(row["firm_envelope_mw"]) + 1e-9]
    feasible = [row for row in trace if float(row["unserved_mw"]) <= 1e-9]
    return {
        "classification": "synthetic_benchmark", "capacity_claim": False,
        "policy": asdict(policy),
        "firm_synthetic_import_envelope_mw": min(min(n0_envelope_mw), min(n1_envelope_mw)),
        "conditional_synthetic_import_envelope_mw": min(n0_envelope_mw),
        "flexibility_enabled_synthetic_envelope_mw": max(float(row["site_demand_mw"]) for row in feasible) if feasible else 0.0,
        "constrained_hours": constrained_hours,
        "maximum_consecutive_interruption_hours": max_consecutive,
        "curtailed_or_shifted_mwh": shifted_mwh,
        "battery_equivalent_cycles": discharged_mwh / policy.battery_energy_mwh if policy.battery_energy_mwh else 0.0,
        "charged_mwh": charged_mwh,
        "rebound_peak_mw": max(float(row["rebound_mw"]) for row in trace),
        "n0_binding_hours": sum(bool(row["n0_binding"]) for row in trace),
        "n1_binding_hours": sum(bool(row["n1_binding"]) for row in trace),
        "unsafe_overstatement_hours": len(unsafe),
        "unserved_mwh": sum(float(row["unserved_mw"]) for row in trace),
        "critical_unserved_mwh": critical_unserved_mwh,
        "flexible_unserved_mwh": flexible_unserved_mwh,
        "ramp_unserved_mwh": ramp_unserved_mwh,
        "workload_deadline_violation_hours": deadline_violation_hours,
        "battery_degradation_cost": discharged_mwh * policy.battery_degradation_cost_per_mwh,
        "ending_recovery_backlog_mwh": recovery_backlog,
        "real_network_validated": False, "connection_capacity_claim": False, "trace": trace,
    }
