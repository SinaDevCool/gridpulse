import unittest

from grid_data.activatable_capacity import (
    ActivationPolicy,
    build_activation_scenarios,
    calculate_activatable_capacity,
    calculate_activation_ensemble,
)


class ActivatableCapacityTests(unittest.TestCase):
    def test_result_is_deterministic_and_separates_firm_from_activatable(self):
        first = calculate_activatable_capacity(
            result_id="ref-1", electrical_ceiling_mw=10, n1_capacity_mw=4
        )
        second = calculate_activatable_capacity(
            result_id="ref-1", electrical_ceiling_mw=10, n1_capacity_mw=4
        )
        self.assertEqual(first["result_sha256"], second["result_sha256"])
        self.assertEqual(first["hourly"]["hour_count"], 8760)
        self.assertGreaterEqual(first["activatable_capacity_mw"], first["conventional_firm_mw"])
        self.assertAlmostEqual(
            first["additional_unlocked_mw"], first["activatable_capacity_mw"] - 4
        )

    def test_battery_state_and_event_metrics_remain_bounded(self):
        result = calculate_activatable_capacity(
            result_id="ref-2",
            electrical_ceiling_mw=8,
            n1_capacity_mw=0,
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
            calculate_activatable_capacity(
                result_id="bad", electrical_ceiling_mw=-1, n1_capacity_mw=0
            )

    def test_release_one_ensemble_is_complete_deterministic_and_ordered(self):
        self.assertEqual(len(build_activation_scenarios()), 27)
        first = calculate_activation_ensemble(
            result_id="ref-ensemble", electrical_ceiling_mw=10, n1_capacity_mw=4
        )
        second = calculate_activation_ensemble(
            result_id="ref-ensemble", electrical_ceiling_mw=10, n1_capacity_mw=4
        )
        self.assertEqual(first["scenario_count"], 27)
        self.assertEqual(first["hours_evaluated"], 236520)
        self.assertEqual(first["scenario_set_sha256"], second["scenario_set_sha256"])
        self.assertEqual(len({item["result_sha256"] for item in first["scenarios"]}), 27)
        confidence = first["confidence"]
        self.assertLessEqual(confidence["p10_mw"], confidence["p50_mw"])
        self.assertLessEqual(confidence["p50_mw"], confidence["p90_mw"])
        self.assertEqual(first["scenario_specific_physics_replays"], 0)


if __name__ == "__main__":
    unittest.main()
