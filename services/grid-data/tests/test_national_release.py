from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from grid_data.geofabrik import STATE_EXTRACTS, state_pbf_url, verify_pbf
from grid_data.national_release import combine_state_releases, write_copy_files


class NationalReleaseTests(unittest.TestCase):
    def test_state_extracts_cover_all_federal_states_once(self) -> None:
        states = [state for values in STATE_EXTRACTS.values() for state in values]
        self.assertEqual(len(states), 16)
        self.assertEqual(len(set(states)), 16)
        self.assertTrue(state_pbf_url("bayern").endswith("/bayern-latest.osm.pbf"))

    def test_checksum_failure_is_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.pbf"
            path.write_bytes(b"pbf")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                verify_pbf(path, "0" * 32)

    def test_aggregate_rejects_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = []
            for state in ("Berlin", "Brandenburg"):
                path = root / f"{state}.ndjson"
                path.write_text(json.dumps({"source_record_id": "osm-way-1", "kind": "line"}) + "\n")
                path.with_suffix(".ndjson.report.json").write_text(json.dumps({"valid": True, "geographic_scope": state, "source_md5": "a" * 32, "records_staged": 1, "counts": {"line": 1}}))
                paths.append(path)
            with self.assertRaisesRegex(ValueError, "duplicate source ID"):
                combine_state_releases(paths, root / "national.json")

    def test_copy_files_split_canonical_layers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "release.ndjson"
            records = [
                {"kind": kind, "source_record_id": f"osm-{kind}-1", "name": kind, "operator": None, "voltage_kv": [], "status": "operational", "geometry": {"type": "Point", "coordinates": [13, 52]}, "metadata": {"capacity_state": "not_established"}}
                for kind in ("node", "line", "industrial_site")
            ]
            source.write_text("".join(json.dumps(record) + "\n" for record in records))
            self.assertEqual(write_copy_files(source, root / "copy"), {"node": 1, "line": 1, "industrial_site": 1})


if __name__ == "__main__":
    unittest.main()
