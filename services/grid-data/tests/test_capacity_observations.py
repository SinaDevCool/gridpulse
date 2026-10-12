import pytest

from grid_data.capacity_observations import (
    PublishedCapacityObservation,
    validate_published_observation,
)


def observation() -> PublishedCapacityObservation:
    return PublishedCapacityObservation(
        source_key="operator-map",
        source_record_id="point-1",
        operator_name="Operator",
        connection_point_name="Point",
        longitude=13.4,
        latitude=52.5,
        voltage_kv=110,
        direction="import",
        value_mw=20,
        band_min_mw=None,
        band_max_mw=None,
        published_at="2026-01-01T00:00:00Z",
        source_url="https://operator.example/point-1",
        non_binding=True,
        reuse_evidence={"basis": "CC BY 4.0"},
    )


def test_permission_required_source_is_not_ingested():
    with pytest.raises(PermissionError):
        validate_published_observation(observation(), reuse_status="permission_required")


def test_permitted_non_binding_observation_remains_public_screening():
    result = validate_published_observation(observation(), reuse_status="permitted")
    assert result["validation_class"] == "public_screening"
    assert result["capacity_state"] == "published_exact"
