import pytest
from pydantic import ValidationError

from grid_data.api.models import ScenarioBoundsRequest


@pytest.mark.parametrize("value", [True, False, "", "1", float("nan"), float("inf")])
def test_scenario_measurements_reject_coercion_and_nonfinite_values(value):
    with pytest.raises(ValidationError):
        ScenarioBoundsRequest(
            temperature_min_c=value,
            temperature_max_c=30,
            onsite_generation_min_mw=0,
            onsite_generation_max_mw=1,
        )


def test_scenario_measurements_preserve_measured_zero():
    assert (
        ScenarioBoundsRequest(
            temperature_min_c=0,
            temperature_max_c=30,
            onsite_generation_min_mw=0,
            onsite_generation_max_mw=1,
        ).temperature_min_c
        == 0
    )
