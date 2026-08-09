import unittest
from dataclasses import replace

from grid_data.network_study import (
    NetworkModelInput,
    PandapowerProvider,
    UnavailableOperatorStudyProvider,
)


class NetworkStudyProviderTests(unittest.TestCase):
    def test_public_default_fails_closed_without_operator_model(self):
        model = NetworkModelInput([], [], [], [], [], [], [], "unknown", 2028, {})
        provider = UnavailableOperatorStudyProvider()

        for result in (
            provider.run_base_case(model),
            provider.run_contingency_analysis(model),
            provider.run_voltage_assessment(model),
            provider.calculate_import_capacity(model),
        ):
            self.assertEqual(result.status, "unavailable")
            self.assertEqual(result.values, {})
            self.assertTrue(result.limitations)

    @staticmethod
    def parameterised_model():
        return NetworkModelInput(
            buses=[
                {"id": "source", "vn_kv": 20.0},
                {"id": "candidate", "vn_kv": 20.0},
            ],
            branches=[
                {
                    "id": "feeder",
                    "from_bus": "source",
                    "to_bus": "candidate",
                    "length_km": 2.0,
                    "r_ohm_per_km": 0.2,
                    "x_ohm_per_km": 0.1,
                    "c_nf_per_km": 0.0,
                    "max_i_ka": 0.2,
                }
            ],
            transformers=[],
            loads=[{"id": "existing", "bus": "candidate", "p_mw": 1.0, "q_mvar": 0.1}],
            generators=[{"id": "grid", "bus": "source", "kind": "external_grid"}],
            switches=[],
            contingencies=[],
            connection_bus="candidate",
            study_year=2026,
            provenance={
                "source_url": "https://simbench.de/en/download/",
                "license": "ODbL-1.0",
            },
            model_id="test-two-bus",
            model_version="v1",
            validation_class="synthetic_demonstration",
        )

    def test_pandapower_solves_ac_case_and_binary_searches_capacity(self):
        provider = PandapowerProvider(maximum_capacity_mw=20, capacity_tolerance_mw=0.05)
        model = self.parameterised_model()

        base = provider.run_base_case(model)
        capacity = provider.calculate_import_capacity(model)

        self.assertEqual(base.status, "demonstration")
        self.assertTrue(base.converged)
        self.assertTrue(base.values["passes"])
        self.assertGreater(capacity.values["firm_import_capacity_mw"], 4)
        self.assertLess(capacity.values["firm_import_capacity_mw"], 7)
        self.assertEqual(capacity.values["binding_constraint"], "line_thermal_loading")

    def test_contingency_failure_reduces_firm_limit(self):
        provider = PandapowerProvider(maximum_capacity_mw=20, capacity_tolerance_mw=0.05)
        model = replace(
            self.parameterised_model(),
            contingencies=[{"id": "feeder-outage", "element_type": "line", "element_id": "feeder"}],
        )

        result = provider.calculate_import_capacity(model)

        self.assertEqual(result.values["binding_case"], "feeder-outage")
        self.assertEqual(result.values["firm_import_capacity_mw"], 0.0)
        self.assertEqual(result.values["binding_constraint"], "unsupplied_load_bus")

    def test_missing_provenance_is_rejected(self):
        provider = PandapowerProvider()
        with self.assertRaisesRegex(ValueError, "provenance"):
            provider.run_base_case(replace(self.parameterised_model(), provenance={}))


if __name__ == "__main__":
    unittest.main()
