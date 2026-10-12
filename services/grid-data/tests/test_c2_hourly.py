from datetime import datetime, timezone

import pytest

from grid_data.c2_hourly import (
    HourlyOperatingCase,
    build_operating_cases,
    calculate_hourly_envelopes,
)
from grid_data.network_study import NetworkModelInput, PandapowerProvider


def model() -> NetworkModelInput:
    return NetworkModelInput(
        buses=[{"id": "source", "vn_kv": 20.0}, {"id": "candidate", "vn_kv": 20.0}],
        branches=[
            {
                "id": "feeder",
                "from_bus": "source",
                "to_bus": "candidate",
                "length_km": 2.0,
                "r_ohm_per_km": 0.2,
                "x_ohm_per_km": 0.1,
                "c_nf_per_km": 0.0,
                "max_i_ka": 0.2,
            }
        ],
        transformers=[],
        loads=[{"id": "existing", "bus": "candidate", "p_mw": 1.0, "q_mvar": 0.1}],
        generators=[{"id": "grid", "bus": "source", "kind": "external_grid"}],
        switches=[],
        contingencies=[],
        connection_bus="candidate",
        study_year=2028,
        provenance={"source_url": "https://simbench.de/en/download/", "license": "ODbL-1.0"},
        model_id="two-bus",
        model_version="v1",
        validation_class="synthetic_demonstration",
    )


def test_operating_case_builder_requires_complete_year():
    with pytest.raises(ValueError, match="8,760"):
        build_operating_cases(weather_year=2025, demand_values=[1.0] * 24)


def test_hourly_ensemble_reports_percentiles_constraints_and_full_lineage():
    cases = [
        HourlyOperatingCase(datetime(2025, 1, 1, hour, tzinfo=timezone.utc), 2025, factor, 0)
        for hour, factor in enumerate([0.5, 1.0, 1.5])
    ]
    result = calculate_hourly_envelopes(
        model(),
        cases,
        requested_import_mw=5,
        provider=PandapowerProvider(maximum_capacity_mw=20, capacity_tolerance_mw=0.1),
    )
    assert result["hour_count"] == 3
    assert result["p10_capacity_mw"] <= result["p50_capacity_mw"] <= result["p90_capacity_mw"]
    assert result["input_sha256"]
    assert all("binding_constraint" in hour for hour in result["hourly"])
    assert result["validation_class"] == "synthetic_demonstration"
    assert result["percentile_semantics"]["firm_screening_value"] == "minimum_capacity_mw"
    assert result["ensemble_manifest"]["case_count"] == 3
    assert result["worst_simulated_condition"]["curtailment_mw"] == result["maximum_curtailment_mw"]
