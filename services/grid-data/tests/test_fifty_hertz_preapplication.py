import json

from grid_data.fifty_hertz_preapplication import build_preapplication_package


def test_package_freezes_predictions_and_separates_evidence(tmp_path):
    regional = tmp_path / "regional.json"
    results = []
    for rank, name in enumerate(["A", "B", "C", "D", "Hamburg/Ost"], 1):
        results.append({
            "rank": rank, "candidate_id": f"site-{rank}", "location": name,
            "coordinates": [10 + rank, 50 + rank], "mapped_voltage_kv": 380,
            "source_url": "https://www.openstreetmap.org/way/1",
            "firm_proxy": {"p10_mw": 600, "central_mw": 800, "p90_mw": 1000},
            "flexible_proxy_mw": 850, "bess_assisted_proxy_mw": 875,
            "binding_constraint": "line_thermal_loading", "binding_case": "line-1-out",
            "electrical_scenarios": {},
        })
    regional.write_text(json.dumps({"results": results}))
    package = build_preapplication_package(
        regional, tmp_path / "package.json", tmp_path / "request.md"
    )
    assert package["summary"]["site_count"] == 5
    assert package["summary"]["passes_p10_count"] == 5
    assert package["freeze_manifest"]["frozen_before_operator_outcome"]
    assert not package["capacity_claim"] and not package["operator_confirmed"]
    hamburg = package["site_dossiers"][-1]
    classes = {row["evidence_class"] for row in hamburg["evidence_ledger"]}
    assert {"official_50hertz_public", "public_open_mapping", "mocked"} <= classes
    assert (tmp_path / "request.md").read_text().startswith("# Draft 50Hertz")
