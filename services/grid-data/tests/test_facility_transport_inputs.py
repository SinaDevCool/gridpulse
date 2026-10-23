"""Transport preservation tests; mathematical validation belongs to the private engine."""
import pytest
from pydantic import ValidationError

from grid_data.api.models import FacilityPlanRequest


def payload():
    return {
        "schema_version": "gridpulse-facility-plan-request-v1", "portfolio_id": "p",
        "requirement": {}, "intervals": [{}], "facility": {}, "workloads": [{}],
        "profiles": [{}], "policy": {}, "economics": {}, "cooling": {},
        "batteries": [{"resource_id": "battery", "maximum_charge_power_mw": 2}],
        "onsite_generation_mw": [0.5], "fleet_gpu_capacity": 125000,
        "idle_gpu_power_watts": 70,
        "fatigue_limits": {"maximum_consecutive_event_hours": 2},
    }


def test_http_shell_preserves_all_canonical_assets():
    assert FacilityPlanRequest.model_validate(payload()).model_dump(mode="json") == payload()


@pytest.mark.parametrize("changes", [{"unknown": 1}, {"fleet_gpu_capacity": -1},
                                    {"fleet_gpu_capacity": 1.5}, {"onsite_generation_mw": []}])
def test_http_shell_rejects_invalid_transport(changes):
    with pytest.raises(ValidationError):
        FacilityPlanRequest.model_validate({**payload(), **changes})
