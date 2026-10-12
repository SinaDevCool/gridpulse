from __future__ import annotations

import json

from grid_data.publish_osm import _staging_rows


def test_staging_rows_maps_national_record(tmp_path):
    source = tmp_path / "national.ndjson"
    source.write_text(
        json.dumps(
            {
                "kind": "node",
                "source_record_id": "osm-node-1",
                "name": "Example",
                "operator": "Operator",
                "voltage_kv": [110],
                "status": "operational",
                "geometry": {"type": "Point", "coordinates": [13.4, 52.5]},
                "metadata": {"power": "substation"},
            }
        )
        + "\n",
        encoding="utf-8",
    )

    assert list(_staging_rows(source, "release-1")) == [
        {
            "release_id": "release-1",
            "kind": "node",
            "source_record_id": "osm-node-1",
            "name": "Example",
            "operator_name": "Operator",
            "voltage_kv": [110],
            "operational_status": "operational",
            "geometry": {"type": "Point", "coordinates": [13.4, 52.5]},
            "metadata": {"power": "substation"},
        }
    ]
