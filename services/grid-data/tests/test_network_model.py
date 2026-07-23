from grid_data.network_model import screen_reference_topology


def test_reference_topology_reports_path_and_limitations() -> None:
    result = screen_reference_topology(
        {
            "source_node_id": "a",
            "target_node_id": "c",
            "nodes": [
                {"id": "a", "voltage_kv": 110},
                {"id": "b", "voltage_kv": 110},
                {"id": "c", "voltage_kv": 110},
            ],
            "edges": [
                {"from": "a", "to": "b", "length_km": 4},
                {"from": "b", "to": "c", "length_km": 6},
            ],
            "lineage": {"release": "fixture-1"},
        }
    )
    assert result["connected"] is True
    assert result["path_length_km"] == 10
    assert result["classification"] == "topology_screening_only"
    assert len(result["limitations"]) == 3
