import json
import tempfile
import unittest
from pathlib import Path

from grid_data.release_audit import audit_release


class ReleaseAuditTest(unittest.TestCase):
    def test_audits_the_accepted_public_release(self) -> None:
        root = Path(__file__).resolve().parents[3]
        source = root / "public" / "power-finder" / "brandenburg-osm.json"
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "audit.json"
            report = audit_release(source, output)
            self.assertTrue(report["valid"], report["errors"])
            self.assertEqual(report["feature_count"], 668)
            self.assertEqual(json.loads(output.read_text())["sha256"], report["sha256"])

    def test_rejects_voltage_that_disagrees_with_the_raw_osm_value(self) -> None:
        root = Path(__file__).resolve().parents[3]
        document = json.loads(
            (root / "public" / "power-finder" / "brandenburg-osm.json").read_text()
        )
        feature = next(
            item
            for item in document["features"]
            if (item["properties"].get("raw_tags", {}).get("voltage") == "30000;750")
        )
        feature["properties"]["voltage_kv"] = [750.0, 30.0]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "invalid.json"
            output = Path(directory) / "audit.json"
            source.write_text(json.dumps(document), encoding="utf-8")
            report = audit_release(source, output)
            self.assertFalse(report["valid"])
            self.assertTrue(
                any("normalized voltage" in error for error in report["errors"]),
                report["errors"],
            )


if __name__ == "__main__":
    unittest.main()
