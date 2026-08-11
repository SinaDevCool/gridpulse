import json

from grid_data.fifty_hertz_regional_screening import (
    build_regional_model,
    load_50hertz_candidates,
    select_geographically_distributed,
)


def test_candidate_loader_filters_voltage_and_deduplicates_names(tmp_path):
    source = tmp_path / "overpass.json"
    source.write_text(json.dumps({"elements": [
        {"type": "way", "id": 1, "center": {"lon": 13, "lat": 52},
         "tags": {"name": "Alpha", "operator": "50Hertz", "voltage": "380000"}},
        {"type": "way", "id": 2, "center": {"lon": 13.1, "lat": 52.1},
         "tags": {"name": "Alpha", "operator": "50Hertz", "voltage": "220000"}},
        {"type": "way", "id": 3, "center": {"lon": 14, "lat": 51},
         "tags": {"name": "Beta", "operator": "50Hertz", "voltage": "400000"}},
    ]}))
    candidates = load_50hertz_candidates(source)
    assert [row.name for row in candidates] == ["Alpha", "Beta"]
    assert candidates[1].voltage_kv == 400


def test_distribution_and_model_are_deterministic(tmp_path):
    source = tmp_path / "overpass.json"
    source.write_text(json.dumps({"elements": [
        {"type": "way", "id": i, "center": {"lon": 10 + i, "lat": 50 + i / 10},
         "tags": {"name": f"Site {i}", "operator": "50Hertz", "voltage": "380000"}}
        for i in range(6)
    ]}))
    candidates = select_geographically_distributed(load_50hertz_candidates(source), 4)
    model = build_regional_model(candidates)
    assert len(candidates) == 4
    assert len(model.branches) >= 4
    assert model.provenance["electrical_truth"] == "fully_synthetic"
    assert model.validation_class == "synthetic_demonstration"
