from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from grid_data.osm import _numbers, build_osm_artifact, build_overpass_query, overpass_to_geojson
from grid_data.sql_export import write_ingestion_sql

FIXTURE = Path(__file__).parent / "fixtures" / "overpass-sample.json"


class OsmConnectorTests(unittest.TestCase):
    def test_voltage_values_are_normalized_from_volts_to_kv(self) -> None:
        self.assertEqual(_numbers("750"), [0.75])
        self.assertEqual(_numbers("30000"), [30.0])
        self.assertEqual(_numbers("110000"), [110.0])
        self.assertEqual(_numbers("30000;750"), [30.0, 0.75])
        self.assertEqual(_numbers("30 kV;750 V"), [30.0, 0.75])
        self.assertEqual(_numbers("invalid"), [])

    def test_query_is_bounded_and_requests_supported_layers(self) -> None:
        query = build_overpass_query((52.2, 13.1, 52.4, 13.5))
        self.assertIn("52.2,13.1,52.4,13.5", query)
        self.assertIn('"power"="substation"', query)
        self.assertIn('"landuse"="industrial"', query)

    def test_sample_converts_to_classified_geojson(self) -> None:
        raw = FIXTURE.read_bytes()
        collection, warnings = overpass_to_geojson(
            json.loads(raw),
            source_url="https://example.test/overpass",
            retrieved_at="2026-07-23T00:00:00+00:00",
            raw_sha256=hashlib.sha256(raw).hexdigest(),
        )
        self.assertEqual(collection["metadata"]["record_count"], 3)
        self.assertFalse(warnings)
        self.assertEqual(
            {feature["properties"]["kind"] for feature in collection["features"]},
            {"node", "line", "industrial_site"},
        )
        self.assertTrue(
            all(
                feature["properties"]["evidence_class"] == "open_mapping"
                for feature in collection["features"]
            )
        )
        self.assertEqual(collection["features"][0]["properties"]["voltage_kv"], [110.0, 20.0])

    def test_artifact_and_transactional_sql_are_reproducible_in_shape(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "osm.json"
            sql = Path(directory) / "load.sql"
            report = build_osm_artifact(
                output,
                bbox=(52.2, 13.1, 52.4, 13.5),
                raw_path=FIXTURE,
                endpoint="https://example.test/overpass",
            )
            count = write_ingestion_sql(output, sql)
            script = sql.read_text(encoding="utf-8")
            self.assertEqual(report.feature_count, 3)
            self.assertEqual(count, 3)
            self.assertTrue(script.startswith("begin;"))
            self.assertTrue(script.rstrip().endswith("commit;"))
            self.assertIn("canonical_grid_nodes", script)
            self.assertIn("canonical_grid_lines", script)
            self.assertIn("canonical_industrial_sites", script)


if __name__ == "__main__":
    unittest.main()
