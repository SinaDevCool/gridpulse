import json

from grid_data.fifty_hertz_synthetic_capacity import (
    SLACK_BUS,
    build_fifty_hertz_synthetic_capacity_artifact,
    build_thyrow_synthetic_model,
)


def test_thyrow_model_separates_public_geography_from_mock_electrical_inputs():
    model = build_thyrow_synthetic_model()
    assert len(model.buses) == 3
    assert len(model.transformers) == 4
    assert len(model.contingencies) == 4
    assert model.generators[0]["bus"] == SLACK_BUS
    assert model.provenance["electrical_truth"] == "fully_synthetic"
    assert model.validation_class == "synthetic_demonstration"


def test_artifact_ranks_yards_and_blocks_capacity_claim(tmp_path):
    output = tmp_path / "50hertz.json"
    artifact = build_fifty_hertz_synthetic_capacity_artifact(output)
    assert len(artifact["results"]) == 2
    assert [row["rank"] for row in artifact["results"]] == [1, 2]
    assert all(not row["capacity_claim"] for row in artifact["results"])
    assert all(row["n1_firm_proxy_mw"] <= row["n0_additional_import_mw"] for row in artifact["results"])
    assert json.loads(output.read_text())["decision"]["screen_first"]
