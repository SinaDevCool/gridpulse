import pytest

from grid_data.flexibility_optimizer import rank_operating_envelopes


def test_optimizer_ranks_only_supplied_candidates() -> None:
    result = rank_operating_envelopes(
        {
            "demand_mw": [80, 90],
            "minimum_critical_load_mw": 50,
            "shiftable_load_mw": 10,
            "battery_power_mw": 10,
            "battery_usable_energy_mwh": 5,
            "interval_minutes": 15,
            "energy_value_eur_mwh": 200,
            "candidates": [
                {"id": "low", "firm_import_mw": 50, "conditional_import_mw": 0},
                {"id": "high", "firm_import_mw": 70, "conditional_import_mw": 10},
            ],
        }
    )
    assert result["selected_candidate_id"] == "high"
    assert result["classification"] == "customer_side_candidate_ranking"


def test_optimizer_requires_supplied_envelopes() -> None:
    with pytest.raises(ValueError, match="supplied"):
        rank_operating_envelopes({"demand_mw": [50], "candidates": []})
