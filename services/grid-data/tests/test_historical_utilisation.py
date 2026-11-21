import copy
import unittest
from grid_data.historical_utilisation import calculate_historical_utilisation


def observations():
    return {
        "schema_version": "gridpulse-generation-observations-v1", "unit_id": "test-unit",
        "technology": "wind", "capacity_basis": "net_ac_mw", "generation_basis": "net_mwh",
        "window_start": "2024-01-01T00:00:00Z", "window_end": "2025-01-01T00:00:00Z",
        "source": {"url": "https://example.org/source", "published_at": "2025-02-01T00:00:00Z",
                   "version": "fixture", "sha256": "a" * 64, "reuse_basis": "private_authorised_analysis"},
        "intervals": [{"start": "2024-01-01T00:00:00Z", "end": "2025-01-01T00:00:00Z",
                       "capacity_mw": 100, "net_generation_mwh": 439200}],
    }


class HistoricalUtilisationTests(unittest.TestCase):
    def test_leap_year_and_no_headroom_claim(self):
        result = calculate_historical_utilisation(observations())
        self.assertEqual(result["capacity_factor"], .5)
        self.assertEqual(result["observed_capacity_hours_mwh"], 878400)
        self.assertFalse(result["capacity_claim"])
        self.assertIsNone(result["connection_headroom_mw"])

    def test_capacity_changes_are_time_weighted(self):
        value = observations()
        value["window_end"] = "2024-01-01T02:00:00Z"
        value["intervals"] = [
            {"start": value["window_start"], "end": "2024-01-01T01:00:00Z", "capacity_mw": 100, "net_generation_mwh": 50},
            {"start": "2024-01-01T01:00:00Z", "end": value["window_end"], "capacity_mw": 200, "net_generation_mwh": 100}]
        self.assertEqual(calculate_historical_utilisation(value)["capacity_factor"], .5)

    def test_missing_is_not_zero(self):
        value = observations()
        value["intervals"][0]["net_generation_mwh"] = None
        result = calculate_historical_utilisation(value)
        self.assertEqual(result["coverage_fraction"], 0)
        self.assertIsNone(result["capacity_factor"])

    def test_annual_average_does_not_hide_anomalous_intervals(self):
        for output in (-10, 110):
            with self.subTest(output=output):
                value = observations()
                value["window_end"] = "2024-01-01T02:00:00Z"
                value["intervals"] = [
                    {"start": value["window_start"], "end": "2024-01-01T01:00:00Z", "capacity_mw": 100, "net_generation_mwh": output},
                    {"start": "2024-01-01T01:00:00Z", "end": value["window_end"], "capacity_mw": 100, "net_generation_mwh": 50}]
                result = calculate_historical_utilisation(value)
                self.assertTrue(0 <= result["observed_capacity_factor"] <= 1)
                self.assertIsNone(result["capacity_factor"])
                self.assertIn("net_output_or_capacity_requires_review", result["quality_flags"])

    def test_overlapping_intervals_fail(self):
        value = observations()
        value["intervals"].append(copy.deepcopy(value["intervals"][0]))
        with self.assertRaises(ValueError):
            calculate_historical_utilisation(value)

    def test_impossible_factor_is_flagged_without_clamping(self):
        value = observations()
        value["intervals"][0]["net_generation_mwh"] = 1_000_000
        result = calculate_historical_utilisation(value)
        self.assertGreater(result["observed_capacity_factor"], 1)
        self.assertIsNone(result["capacity_factor"])

    def test_storage_and_unlicensed_or_dc_inputs_fail(self):
        for key, bad in [("technology", "storage"), ("capacity_basis", "dc_mw")]:
            value = observations()
            value[key] = bad
            with self.assertRaises(ValueError):
                calculate_historical_utilisation(value)
        value = observations()
        value["source"]["reuse_basis"] = "unknown"
        with self.assertRaises(ValueError):
            calculate_historical_utilisation(value)
