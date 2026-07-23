from __future__ import annotations

import unittest

from grid_data.operator_matching import propose_operator_matches


class OperatorMatchingTests(unittest.TestCase):
    def test_close_name_voltage_match_is_proposed_not_accepted(self) -> None:
        mapped = [
            {
                "source_record_id": "osm-1",
                "name": "Umspannwerk Neuenhagen",
                "operator": "50Hertz",
                "voltage_kv": [380, 220],
                "latitude": 52.52,
                "longitude": 13.69,
            }
        ]
        official = [
            {
                "source_record_id": "50hz-neuenhagen",
                "name": "Neuenhagen",
                "operator": "50Hertz Transmission GmbH",
                "voltage_kv": [380],
                "latitude": 52.521,
                "longitude": 13.691,
            }
        ]
        proposals = propose_operator_matches(mapped, official)
        self.assertEqual(len(proposals), 1)
        self.assertEqual(proposals[0]["node_source_record_id"], "osm-1")
        self.assertIn("Human review is required", proposals[0]["rationale"])

    def test_distant_record_is_not_proposed(self) -> None:
        mapped = [
            {
                "source_record_id": "osm-1",
                "name": "Neuenhagen",
                "voltage_kv": [380],
                "latitude": 52.52,
                "longitude": 13.69,
            }
        ]
        official = [
            {
                "source_record_id": "official-1",
                "name": "Neuenhagen",
                "voltage_kv": [380],
                "latitude": 51.0,
                "longitude": 10.0,
            }
        ]
        self.assertEqual(propose_operator_matches(mapped, official), [])


if __name__ == "__main__":
    unittest.main()
