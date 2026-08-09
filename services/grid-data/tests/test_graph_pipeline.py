from grid_data.graph.pipeline import run_graph_guided_study
from grid_data.graph.provider import InMemoryTopologyProvider
from grid_data.network_study import NetworkModelInput, StudyResult
from grid_data.p0_foundation import ScenarioDefinition


class DeterministicStudyProvider:
    def calculate_import_capacity(self, model):
        load = sum(float(row.get("p_mw", 0)) for row in model.loads)
        return StudyResult(
            status="demonstration",
            study_type="capacity",
            provider="test-physics",
            solver_version="1",
            converged=True,
            values={
                "firm_import_capacity_mw": 40 - load,
                "binding_case": "base",
                "binding_constraint": "line-1",
            },
        )

    def calculate_export_capacity(self, _model):
        return StudyResult(
            status="demonstration",
            study_type="export_capacity",
            provider="test-physics",
            solver_version="1",
            converged=True,
            values={"firm_export_capacity_mw": 20},
        )


def model():
    return NetworkModelInput(
        model_id="mock:pipeline:network",
        model_version="v1",
        validation_class="synthetic_demonstration",
        buses=[{"id": "a", "vn_kv": 20}, {"id": "b", "vn_kv": 20}],
        branches=[
            {
                "id": "line-1",
                "from_bus": "a",
                "to_bus": "b",
                "length_km": 1,
                "r_ohm_per_km": 0.2,
                "x_ohm_per_km": 0.1,
                "max_i_ka": 0.2,
            }
        ],
        transformers=[],
        loads=[{"id": "load", "bus": "b", "p_mw": 5, "q_mvar": 1}],
        generators=[{"id": "grid", "bus": "a", "kind": "external_grid"}],
        switches=[],
        contingencies=[],
        connection_bus="b",
        study_year=2028,
        provenance={"source_url": "https://simbench.de", "license": "ODbL-1.0"},
    )


def test_complete_graph_study_uses_typed_quarantine_contract():
    report = run_graph_guided_study(
        model=model(),
        scenarios=[ScenarioDefinition(scenario_id="normal")],
        source_bus="a",
        target_buses=["b"],
        mandatory_contingencies=set(),
        budget=1,
        provider=DeterministicStudyProvider(),
        topology_provider=InMemoryTopologyProvider(),
    )

    assert report["topology_provider"] == "deterministic_in_memory"
    assert report["validation_against_full_set"]["selected_solver_failures"] == []
    assert report["validation_against_full_set"]["full_set_solver_failures"] == []
    assert report["validation_against_full_set"]["safe_for_prioritisation"] is True
    assert report["capacity_claim"] is False


def test_solver_failures_are_quarantined_without_contract_crash():
    class FailingProvider(DeterministicStudyProvider):
        def calculate_import_capacity(self, _model):
            raise RuntimeError("controlled solver failure")

    report = run_graph_guided_study(
        model=model(),
        scenarios=[ScenarioDefinition(scenario_id="normal")],
        source_bus="a",
        target_buses=["b"],
        mandatory_contingencies=set(),
        budget=1,
        provider=FailingProvider(),
        topology_provider=InMemoryTopologyProvider(),
    )

    assert report["validation_against_full_set"]["safe_for_prioritisation"] is False
    assert (
        report["validation_against_full_set"]["selected_solver_failures"][0]["error"]
        == "RuntimeError"
    )
    assert (
        report["validation_against_full_set"]["full_set_solver_failures"][0]["error"]
        == "RuntimeError"
    )


def test_promoted_reduction_does_not_repeat_full_enumeration():
    class CountingProvider(DeterministicStudyProvider):
        calls = 0

        def calculate_import_capacity(self, model):
            self.calls += 1
            return super().calculate_import_capacity(model)

    provider = CountingProvider()
    scenarios = [ScenarioDefinition(scenario_id=f"scenario-{index}") for index in range(5)]
    report = run_graph_guided_study(
        model=model(),
        scenarios=scenarios,
        source_bus="a",
        target_buses=["b"],
        mandatory_contingencies=set(),
        budget=2,
        provider=provider,
        topology_provider=InMemoryTopologyProvider(),
        validation_mode="promoted",
        reduction_policy={
            "policy_version": "benchmark-v1",
            "model_version": "v1",
            "accepted_for_reduced_search": True,
            "mandatory_recall": 1,
            "false_safe_rate": 0,
        },
    )
    assert provider.calls == 2
    assert report["validation_against_full_set"]["full_physics_executed_this_run"] is False
    assert report["validation_against_full_set"]["policy_validation_reused"] is True
