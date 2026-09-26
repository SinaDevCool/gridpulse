from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from grid_data.mastr import parse_mastr_export, stream_mastr_export
from grid_data.sql_export import write_mastr_sql

FIXTURE = Path(__file__).parent / "fixtures" / "mastr-sample.xml"


class MastrConnectorTests(unittest.TestCase):
    def test_streams_classified_assets_from_a_full_export_zip(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "mastr.zip"
            output_path = Path(directory) / "assets.json"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.write(FIXTURE, "Einheiten.xml")

            report = parse_mastr_export(
                archive_path,
                output_path,
                federal_state="Brandenburg",
            )
            payload = json.loads(output_path.read_text(encoding="utf-8"))

            self.assertEqual(report.asset_count, 2)
            self.assertEqual(payload["metadata"]["record_count"], 2)
            self.assertEqual(payload["assets"][0]["net_capacity_mw"], 12.5)
            self.assertEqual(payload["assets"][0]["asset_type"], "generation")
            self.assertEqual(payload["assets"][1]["asset_type"], "storage")
            self.assertEqual(payload["assets"][1]["storage_energy_mwh"], 10)
            self.assertIn("not available grid capacity", payload["metadata"]["evidence_boundary"])
            sql_path = Path(directory) / "mastr.sql"
            self.assertEqual(write_mastr_sql(output_path, sql_path), 2)
            script = sql_path.read_text(encoding="utf-8")
            self.assertIn("canonical_energy_assets", script)
            self.assertTrue(script.startswith("begin;"))
            self.assertTrue(script.rstrip().endswith("commit;"))

    def test_state_filter_excludes_other_regions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "mastr.zip"
            output_path = Path(directory) / "assets.json"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.write(FIXTURE, "Einheiten.xml")
            report = parse_mastr_export(archive_path, output_path, federal_state="Bayern")
            self.assertEqual(report.asset_count, 0)

    def test_production_stream_is_ndjson_and_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "mastr.zip"
            output_path = Path(directory) / "assets.ndjson"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.write(FIXTURE, "EinheitenSolar.xml")

            report = stream_mastr_export(
                archive_path,
                output_path,
                federal_state="Brandenburg",
            )
            records = [
                json.loads(line) for line in output_path.read_text(encoding="utf-8").splitlines()
            ]
            validation = json.loads(
                output_path.with_suffix(".ndjson.report.json").read_text(encoding="utf-8")
            )

            self.assertEqual(report.asset_count, 2)
            self.assertEqual(records[0]["record_type"], "manifest")
            self.assertEqual(records[1]["record_type"], "asset")
            self.assertEqual(records[2]["asset_type"], "storage")
            self.assertTrue(validation["valid"])
            self.assertEqual(validation["asset_count"], 2)

    def test_national_map_stream_keeps_only_exact_generation_and_storage(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "mastr.zip"
            output_path = Path(directory) / "assets.ndjson"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.write(FIXTURE, "EinheitenSolar.xml")

            report = stream_mastr_export(
                archive_path,
                output_path,
                exact_map_points_only=True,
            )
            records = [
                json.loads(line) for line in output_path.read_text(encoding="utf-8").splitlines()
            ]

            self.assertEqual(report.asset_count, 2)
            self.assertTrue(records[0]["exact_map_points_only"])
            self.assertTrue(all(record.get("longitude") for record in records[1:]))


if __name__ == "__main__":
    unittest.main()
