from __future__ import annotations

import unittest

from grid_data.release_b_network import NETWORK_VERSION, screen_release_b_network


class ReleaseBNetworkTests(unittest.TestCase):
    def test_is_deterministic_synthetic_and_unvalidated(self) -> None:
        payload = {
            "node_id": "node-110",
            "voltage_kv": 110,
            "distance_km": 3,
            "minimum_firm_mw": 40,
            "redundancy": "single_feed",
        }
        result = screen_release_b_network(payload)
        self.assertEqual(result, screen_release_b_network(payload))
        self.assertEqual(result["network_version"], NETWORK_VERSION)
        self.assertEqual(result["validation_status"], "unvalidated_reference_model")
        self.assertTrue(result["not_for_connection_decision"])
        self.assertEqual(len(result["branches"]), 3)

    def test_n_minus_one_selects_outage_limit(self) -> None:
        common = {
            "node_id": "node-110",
            "voltage_kv": 110,
            "distance_km": 3,
            "minimum_firm_mw": 20,
        }
        n0 = screen_release_b_network({**common, "redundancy": "single_feed"})
        n1 = screen_release_b_network({**common, "redundancy": "n_minus_one"})
        self.assertEqual(n0["selected_security_limit_mw"], n0["n0_transfer_limit_mw"])
        self.assertEqual(n1["selected_security_limit_mw"], n1["n1_transfer_limit_mw"])
        self.assertLessEqual(n1["n1_transfer_limit_mw"], n1["n0_transfer_limit_mw"])


if __name__ == "__main__":
    unittest.main()
