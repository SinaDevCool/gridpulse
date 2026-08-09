import unittest

from grid_data.activatable_capacity import ActivationPolicy, calculate_activatable_capacity


class ActivatableCapacityTests(unittest.TestCase):
    def test_result_is_deterministic_and_separates_firm_from_activatable(self):
        first = calculate_activatable_capacity(result_id="ref-1", electrical_ceiling_mw=10, n1_capacity_mw=4)
        second = calculate_activatable_capacity(result_id="ref-1", electrical_ceiling_mw=10, n1_capacity_mw=4)
        self.assertEqual(first["result_sha256"], second["result_sha256"])
        self.assertEqual(first["hourly"]["hour_count"], 8760)
        self.assertGreaterEqual(first["activatable_capacity_mw"], first["conventional_firm_mw"])
        self.assertAlmostEqual(first["additional_unlocked_mw"], first["activatable_capacity_mw"] - 4)

    def test_battery_state_and_event_metrics_remain_bounded(self):
        result = calculate_activatable_capacity(
            result_id="ref-2", electrical_ceiling_mw=8, n1_capacity_mw=0,
            policy=ActivationPolicy(battery_power_fraction=0.25, battery_duration_hours=4),
        )
        battery = result["bess_assisted"]
        self.assertLessEqual(battery["capacity_mw"], 8)
        self.assertLessEqual(battery["maximum_reduction_mw"], battery["capacity_mw"])
        self.assertGreaterEqual(battery["demand_served_percent"], 0)
        self.assertLessEqual(battery["demand_served_percent"], 100)
        self.assertEqual(len(result["hourly"]["samples"]), 169)

    def test_invalid_capacity_is_rejected(self):
        with self.assertRaises(ValueError):
            calculate_activatable_capacity(result_id="bad", electrical_ceiling_mw=-1, n1_capacity_mw=0)


if __name__ == "__main__":
    unittest.main()
