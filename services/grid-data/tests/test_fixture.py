import json
import tempfile
import unittest
from pathlib import Path

from grid_data.fixture import build_fixture, validate_fixture


FIXTURE = Path(__file__).parent / "fixtures" / "brandenburg-screening-source.json"


class FixturePipelineTest(unittest.TestCase):
    def test_source_fixture_is_valid_and_reproducible(self) -> None:
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
        first = validate_fixture(payload)
        second = validate_fixture(payload)
        self.assertTrue(first.valid)
        self.assertEqual(first.sha256, second.sha256)
        self.assertEqual(first.feature_count, 7)

    def test_published_fixture_contains_boundary_and_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "fixture.json"
            report = build_fixture(FIXTURE, output)
            published = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(published["metadata"]["artifact_sha256"], report.sha256)
            self.assertIn("Synthetic development fixture", published["metadata"]["evidence_boundary"])

    def test_rejects_unlabelled_capacity_claim(self) -> None:
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
        payload["features"][0]["properties"]["evidence_class"] = "official_operator"
        report = validate_fixture(payload)
        self.assertFalse(report.valid)
        self.assertTrue(any("test_fixture" in error for error in report.errors))


if __name__ == "__main__":
    unittest.main()

