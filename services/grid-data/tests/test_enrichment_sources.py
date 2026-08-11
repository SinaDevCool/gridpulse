import json
import tempfile
import unittest
from pathlib import Path

from grid_data.enrichment_sources import normalize_enrichment_geojson


class EnrichmentSourceTests(unittest.TestCase):
    def test_normalizes_bkg_admin_and_writes_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "vg250.geojson"
            output = root / "vg250.ndjson"
            source.write_text(json.dumps({"type": "FeatureCollection", "features": [{
                "type": "Feature", "id": "11000000",
                "properties": {"GEN": "Berlin", "AGS": "11000000", "LKZ": "BE"},
                "geometry": {"type": "MultiPolygon", "coordinates": [[[[13, 52], [14, 52], [14, 53], [13, 52]]]]},
            }]}), encoding="utf-8")
            report = normalize_enrichment_geojson("bkg_admin", source, output)
            self.assertEqual(report.records, 1)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["official_name"], "Berlin")
            self.assertTrue(output.with_suffix(".ndjson.manifest.json").exists())

    def test_fails_closed_when_all_geometry_is_invalid(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.geojson"
            source.write_text(json.dumps({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}}]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "all source records"):
                normalize_enrichment_geojson("bfn_protected", source, Path(directory) / "out.ndjson")


if __name__ == "__main__":
    unittest.main()
