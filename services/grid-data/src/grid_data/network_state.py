"""Release 1 construction of physically effective, provenance-preserving network states."""

from __future__ import annotations

import copy
from dataclasses import asdict, replace
from typing import Any

from .contracts import PilotDataBundle
from .network_study import NetworkModelInput
from .p0_foundation import ScenarioDefinition, canonical_hash


class NetworkStateBuilder:
    def __init__(self, bundle: PilotDataBundle) -> None:
        bundle.validate()
        self.bundle = bundle

    @staticmethod
    def _bus_factor(item: dict[str, Any], factors: dict[str, Any], default: float) -> float:
        return float(factors.get(str(item.get("bus")), default))

    def build(self, scenario: ScenarioDefinition) -> NetworkModelInput:
        scenario.validate()
        model = self.bundle.network_model
        buses = {str(item["id"]) for item in model.buses}
        demand_by_bus = scenario.metadata.get("demand_factors_by_bus", {})
        renewable_by_bus = scenario.metadata.get("renewable_factors_by_bus", {})
        if not isinstance(demand_by_bus, dict) or not isinstance(renewable_by_bus, dict):
            raise TypeError("Nodal demand and renewable factors must be mappings.")

        loads = []
        for item in copy.deepcopy(model.loads):
            factor = self._bus_factor(item, demand_by_bus, scenario.demand_factor)
            item["p_mw"] = float(item.get("p_mw", 0)) * factor
            item["q_mvar"] = float(item.get("q_mvar", 0)) * factor
            loads.append(item)

        generators = []
        battery_remaining = scenario.battery_dispatch_mw
        for item in copy.deepcopy(model.generators):
            if item.get("slack") or item.get("kind") == "external_grid":
                generators.append(item)
                continue
            if item.get("kind") == "battery":
                maximum = float(item.get("max_p_mw", item.get("p_mw", 0)))
                dispatch = min(battery_remaining, maximum * scenario.battery_availability)
                item["p_mw"] = dispatch
                battery_remaining -= dispatch
            else:
                factor = self._bus_factor(item, renewable_by_bus, scenario.renewable_factor)
                item["p_mw"] = float(item.get("p_mw", 0)) * factor
                item["q_mvar"] = float(item.get("q_mvar", 0)) * factor
            generators.append(item)
        if battery_remaining > 1e-9:
            raise ValueError("Requested battery dispatch exceeds available modelled battery power.")

        reduction_remaining = scenario.flexible_load_reduction_mw
        eligible = [item for item in loads if float(item.get("flexible_mw", 0)) > 0]
        available_reduction = (
            sum(float(item["flexible_mw"]) for item in eligible)
            * scenario.flexible_load_availability
        )
        if reduction_remaining > available_reduction + 1e-9:
            raise ValueError("Requested load reduction exceeds available modelled flexibility.")
        for item in eligible:
            reduction = min(
                reduction_remaining,
                float(item["flexible_mw"]) * scenario.flexible_load_availability,
                float(item["p_mw"]),
            )
            item["p_mw"] -= reduction
            reduction_remaining -= reduction

        queue = {item.project_id: item for item in self.bundle.queue}
        requested_queue = scenario.queue_project_ids
        if scenario.accepted_connections_mw and requested_queue:
            raise ValueError("Use nodal queue IDs or legacy aggregate queue MW, not both.")
        for project_id in requested_queue:
            item = queue.get(project_id)
            if item is None:
                raise ValueError(f"Unknown queue project {project_id}")
            if item.candidate_bus not in buses:
                raise ValueError(f"Queue project {project_id} references an unknown bus.")
            if item.import_mw:
                loads.append(
                    {
                        "id": item.project_id,
                        "bus": item.candidate_bus,
                        "p_mw": item.import_mw,
                        "q_mvar": 0.0,
                        "kind": "queued_connection",
                    }
                )
            if item.export_mw:
                generators.append(
                    {
                        "id": f"{item.project_id}-export",
                        "bus": item.candidate_bus,
                        "p_mw": item.export_mw,
                        "q_mvar": 0.0,
                        "kind": "queued_connection",
                    }
                )
        if scenario.accepted_connections_mw:
            loads.append(
                {
                    "id": f"legacy-queue-{scenario.scenario_id}",
                    "bus": model.connection_bus,
                    "p_mw": scenario.accepted_connections_mw,
                    "q_mvar": 0.0,
                    "kind": "legacy_aggregate",
                }
            )

        switches = copy.deepcopy(model.switches)
        states = {item.state_id: item for item in self.bundle.switching_states}
        state = states.get(scenario.switching_state)
        if state is None:
            raise ValueError(f"Unknown switching state {scenario.switching_state}")
        switch_by_id = {str(item.get("id")): item for item in switches}
        for switch_id, closed in state.switch_positions.items():
            if switch_id not in switch_by_id:
                raise ValueError(f"Switching state references unknown switch {switch_id}")
            switch_by_id[switch_id]["closed"] = bool(closed)

        branches = copy.deepcopy(model.branches)
        transformers = copy.deepcopy(model.transformers)
        reinforcement_by_id = {item.reinforcement_id: item for item in self.bundle.reinforcements}
        for reinforcement_id in scenario.reinforcement_ids:
            reinforcement = reinforcement_by_id.get(reinforcement_id)
            if reinforcement is None:
                raise ValueError(f"Unknown reinforcement {reinforcement_id}")
            if scenario.reinforcement_delay_years > 0:
                continue
            element = copy.deepcopy(reinforcement.parameter_changes.get("element"))
            collection = reinforcement.parameter_changes.get("collection")
            if (
                reinforcement.action == "add"
                and element
                and collection in {"branches", "transformers"}
            ):
                (branches if collection == "branches" else transformers).append(element)
            elif reinforcement.action in {"replace", "uprate"}:
                target = (
                    branches
                    if collection == "branches"
                    else transformers
                    if collection == "transformers"
                    else None
                )
                if target is None:
                    raise ValueError(
                        f"Reinforcement {reinforcement_id} has no supported collection."
                    )
                match = next(
                    (
                        item
                        for item in target
                        if str(item.get("id")) in reinforcement.affected_element_ids
                    ),
                    None,
                )
                if match is None:
                    raise ValueError(
                        f"Reinforcement {reinforcement_id} references no model element."
                    )
                match.update(
                    {
                        key: value
                        for key, value in reinforcement.parameter_changes.items()
                        if key != "collection"
                    }
                )
            else:
                raise ValueError(
                    f"Reinforcement {reinforcement_id} has no executable model change."
                )

        # A scenario is one effective operating state. Do not silently apply the
        # model's full contingency catalogue to every base state; a specific
        # outage is activated only when the scenario names it.
        contingency_catalogue = copy.deepcopy(model.contingencies)
        contingencies: list[dict[str, Any]] = []
        if scenario.contingency_id and scenario.planned_outage_id:
            raise ValueError("Use a contingency or a planned outage in one state, not both.")
        if scenario.planned_outage_id:
            outage = next(
                (
                    item
                    for item in self.bundle.planned_outages
                    if item.outage_id == scenario.planned_outage_id
                ),
                None,
            )
            if outage is None:
                raise ValueError(f"Unknown planned outage {scenario.planned_outage_id}")
            contingencies = [
                {
                    "id": outage.outage_id,
                    "element_type": outage.element_type,
                    "element_id": outage.element_id,
                    "case_type": "planned_outage",
                }
            ]
        elif scenario.contingency_id:
            contingencies = [
                item
                for item in contingency_catalogue
                if str(item.get("id")) == scenario.contingency_id
            ]
            if not contingencies:
                raise ValueError(f"Unknown contingency {scenario.contingency_id}")

        provenance = copy.deepcopy(model.provenance)
        provenance["network_state"] = {
            "scenario_id": scenario.scenario_id,
            "switching_state": scenario.switching_state,
            "queue_project_ids": list(requested_queue),
            "reinforcement_ids": list(scenario.reinforcement_ids),
            "weather_year": scenario.weather_year,
            "hour_of_year": scenario.hour_of_year,
            "planned_outage_id": scenario.planned_outage_id,
        }
        return replace(
            model,
            branches=branches,
            transformers=transformers,
            loads=loads,
            generators=generators,
            switches=switches,
            contingencies=contingencies,
            provenance=provenance,
        )

    def manifest(
        self, scenario: ScenarioDefinition, state: NetworkModelInput | None = None
    ) -> dict[str, Any]:
        """Return the private, reproducible ledger record for an effective state."""
        state = state or self.build(scenario)
        return {
            "schema_version": "gridpulse-network-state-manifest-v1",
            "scenario_id": scenario.scenario_id,
            "scenario_sha256": scenario.input_hash,
            "state_sha256": canonical_hash(asdict(state)),
            "validation_class": state.validation_class,
            "switching_state": scenario.switching_state,
            "queue_project_ids": list(scenario.queue_project_ids),
            "reinforcement_ids": list(scenario.reinforcement_ids),
            "weather_year": scenario.weather_year,
            "hour_of_year": scenario.hour_of_year,
            "planned_outage_id": scenario.planned_outage_id,
            "provenance": state.provenance,
        }
