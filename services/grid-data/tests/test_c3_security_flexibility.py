import pytest

from grid_data.c3_security_flexibility import (
    FlexibilityPortfolio,
    build_fca_proposal,
    optimize_flexibility,
)


def test_dispatch_respects_envelopes_and_soc() -> None:
    result = optimize_flexibility(
        timestamps=["2028-01-01T00:00:00Z", "2028-01-01T01:00:00Z", "2028-01-01T02:00:00Z"],
        demand_mw=[4, 4, 4],
        onsite_generation_mw=[0, 2, 0],
        import_envelope_mw=[3, 3, 3],
        export_envelope_mw=[1, 1, 1],
        price_eur_mwh=[20, 10, 100],
        portfolio=FlexibilityPortfolio(
            battery_power_mw=2,
            battery_energy_mwh=4,
            flexible_load_mw=1,
            maximum_flexible_energy_mwh=3,
        ),
    )
    assert result["summary"]["unserved_energy_mwh"] == 0
    assert all(row["grid_import_mw"] <= 3 for row in result["hourly"])
    assert result["hourly"][-1]["battery_soc_mwh"] >= 2
    assert result["feasibility"] == "serves_all_load"
    assert result["summary"]["maximum_power_balance_error_mw"] <= 1e-8


def test_invalid_battery_inputs_are_rejected() -> None:
    with pytest.raises(ValueError, match="Battery energy"):
        optimize_flexibility(
            timestamps=["2028-01-01T00:00:00Z"],
            demand_mw=[1], onsite_generation_mw=[0], import_envelope_mw=[1],
            export_envelope_mw=[0], price_eur_mwh=[50],
            portfolio=FlexibilityPortfolio(battery_power_mw=1, battery_energy_mwh=0),
        )


def test_static_fca_uses_conservative_month_hour_block() -> None:
    result = build_fca_proposal(
        ["2028-01-01T00:00:00Z", "2028-01-02T00:00:00Z"],
        [5, 3],
        [4, 2],
        contract_start="2028-01-01",
        contract_end="2028-12-31",
        mode="static",
    )
    assert [row["maximum_import_mw"] for row in result["limits"]] == [3, 3]
    assert result["operator_confirmation_required"] is True
    assert result["status"] == "non_binding_operator_contract_proposal"
