from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from grid_data.c2_sources import HourlySeries
from grid_data.network_state import NetworkStateBuilder
from grid_data.p0_foundation import ScenarioDefinition
from grid_data.p1_permutation import execute_permutations
from grid_data.pilot_providers import SyntheticPilotDataProvider
from grid_data.source_quality import accepted_release_manifest, assess_hourly_series

FIXTURE = Path(__file__).parents[1] / "fixtures" / "synthetic-pilot"


@pytest.fixture(scope="module")
def builder():
    return NetworkStateBuilder(SyntheticPilotDataProvider(FIXTURE).load())


def test_nodal_factors_queue_switching_and_contingency_are_effective(builder):
    scenario = ScenarioDefinition(
        "effective-state",
        demand_factor=1.2,
        renewable_factor=0.5,
        queue_project_ids=("synthetic-queue-001",),
        switching_state="line-a-open",
        contingency_id="synthetic-n-1-line-a-b",
        metadata={"demand_factors_by_bus": {"synthetic-mv-b": 0.8}},
    )
    state = builder.build(scenario)
    loads = {item["id"]: item for item in state.loads}
    generators = {item["id"]: item for item in state.generators}
    assert loads["synthetic-existing-load-a"]["p_mw"] == pytest.approx(21.6)
    assert loads["synthetic-existing-load-b"]["p_mw"] == pytest.approx(9.6)
    assert loads["synthetic-queue-001"]["bus"] == "synthetic-mv-a"
    assert generators["synthetic-solar-b"]["p_mw"] == pytest.approx(2)
    assert state.switches[0]["closed"] is False
    assert [item["id"] for item in state.contingencies] == ["synthetic-n-1-line-a-b"]


def test_reinforcement_battery_and_flexible_load_change_physical_state(builder):
    state = builder.build(
        ScenarioDefinition(
            "flex-state",
            battery_dispatch_mw=6,
            battery_availability=0.75,
            flexible_load_reduction_mw=3,
            flexible_load_availability=1,
            reinforcement_ids=("synthetic-reinforcement-trafo-2",),
        )
    )
    assert len(state.transformers) == 2
    assert next(item for item in state.generators if item["kind"] == "battery")["p_mw"] == 6
    assert (
        next(item for item in state.loads if item["id"] == "synthetic-existing-load-b")["p_mw"] == 9
    )


def test_delay_withholds_reinforcement_and_invalid_inputs_fail_closed(builder):
    delayed = builder.build(
        ScenarioDefinition(
            "delayed",
            reinforcement_ids=("synthetic-reinforcement-trafo-2",),
            reinforcement_delay_years=2,
        )
    )
    assert len(delayed.transformers) == 1
    with pytest.raises(ValueError, match="Unknown switching state"):
        builder.build(ScenarioDefinition("bad-switch", switching_state="invented"))
    with pytest.raises(ValueError, match="exceeds available"):
        builder.build(ScenarioDefinition("bad-battery", battery_dispatch_mw=11))
    with pytest.raises(ValueError, match="exceeds available"):
        builder.build(ScenarioDefinition("bad-flex", flexible_load_reduction_mw=5))


def test_network_state_manifest_is_reproducible(builder):
    scenario = ScenarioDefinition(
        "manifest-state",
        weather_year=2025,
        hour_of_year=42,
        queue_project_ids=("synthetic-queue-001",),
    )
    first = builder.manifest(scenario)
    second = builder.manifest(scenario)
    assert first == second
    assert len(first["state_sha256"]) == 64
    assert first["queue_project_ids"] == ["synthetic-queue-001"]


def test_hourly_source_acceptance_preserves_public_context_boundary():
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    values = tuple((start + timedelta(hours=index), float(index)) for index in range(24))
    series = HourlySeries(
        "bnetza-smard-grid-load",
        "actual_grid_load",
        "MWh_per_hour",
        values,
        {
            "source_url": "https://www.smard.de/en/datennutzung",
            "licence": "CC-BY-4.0",
            "artifact_sha256": "a" * 64,
            "evidence_boundary": "German system context; not feeder loading or capacity.",
        },
    )
    report = assess_hourly_series(
        series,
        start=start,
        end_exclusive=start + timedelta(hours=24),
        parser_version="smard-hourly-v1",
    )
    manifest = accepted_release_manifest([report])
    assert report.accepted
    assert manifest["capacity_claim"] is False


def test_incomplete_hourly_source_is_rejected():
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    series = HourlySeries(
        "dwd-test",
        "temperature",
        "C",
        ((start, 1.0),),
        {"source_url": "https://opendata.dwd.de", "licence": "DWD", "artifact_sha256": "b" * 64},
    )
    report = assess_hourly_series(
        series,
        start=start,
        end_exclusive=start + timedelta(hours=24),
        parser_version="dwd-v1",
    )
    assert not report.accepted
    with pytest.raises(ValueError, match="fully accepted"):
        accepted_release_manifest([report])


def test_permutation_executor_uses_validated_state_builder(builder):
    class Provider:
        def calculate_import_capacity(self, model):
            from grid_data.network_study import StudyResult

            queued = sum(
                item["p_mw"] for item in model.loads if item.get("kind") == "queued_connection"
            )
            return StudyResult(
                "demonstration",
                "capacity",
                "test",
                "1",
                True,
                {
                    "firm_import_capacity_mw": 100 - queued,
                    "binding_case": "base",
                    "binding_constraint": "line",
                },
            )

        def calculate_export_capacity(self, model):
            from grid_data.network_study import StudyResult

            return StudyResult(
                "demonstration",
                "export_capacity",
                "test",
                "1",
                True,
                {"firm_export_capacity_mw": 25},
            )

    result = execute_permutations(
        builder.bundle.network_model,
        [ScenarioDefinition("nodal", queue_project_ids=("synthetic-queue-001",))],
        Provider(),
        state_builder=builder,
    )
    assert result["failure_count"] == 0
    assert result["firm_import_capacity_mw"] == 85
    assert result["network_state_manifests"][0]["scenario_id"] == "nodal"


def test_planned_outage_is_an_executable_physics_case(builder):
    outage_id = "mock:de-pilot-01:planned-outage:line-a-b"
    state = builder.build(ScenarioDefinition("planned", planned_outage_id=outage_id))
    assert state.contingencies == [
        {
            "id": outage_id,
            "element_type": "line",
            "element_id": "synthetic-line-a-b",
            "case_type": "planned_outage",
        }
    ]
    assert state.provenance["network_state"]["planned_outage_id"] == outage_id
