from __future__ import annotations

import unittest

from grid_data.synthetic_capacity import SCENARIO_VERSION, screen_synthetic_capacity


class SyntheticCapacityTests(unittest.TestCase):
    def test_is_deterministic_and_explicitly_synthetic(self) -> None:
        payload = {"node_id": "node-1", "voltage_kv": 110, "requested_import_mw": 80}
        first = screen_synthetic_capacity(payload)
        self.assertEqual(first, screen_synthetic_capacity(payload))
        self.assertEqual(first["scenario_version"], SCENARIO_VERSION)
        self.assertEqual(first["evidence_status"], "synthetic")
        self.assertTrue(first["not_for_connection_decision"])

    def test_larger_load_has_more_constrained_hours(self) -> None:
        common = {"node_id": "node-1", "voltage_kv": 110}
        small = screen_synthetic_capacity({**common, "requested_import_mw": 20})
        large = screen_synthetic_capacity({**common, "requested_import_mw": 250})
        self.assertLess(small["constrained_hours_per_year"], large["constrained_hours_per_year"])

    def test_rejects_missing_node(self) -> None:
        with self.assertRaises(ValueError):
            screen_synthetic_capacity({"requested_import_mw": 20})


if __name__ == "__main__":
    unittest.main()
