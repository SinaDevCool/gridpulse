from __future__ import annotations

import unittest

from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition
from grid_data.p3_surrogate import train_surrogates
from grid_data.release3_pipeline import run_release3
from grid_data.release3_shadow import assess_feature_drift, evaluate_shadow_run


def outcome(index: int, *, prefix: str = "train", validation: str = "synthetic_demonstration"):
    scenario = ScenarioDefinition(
        scenario_id=f"{prefix}-{index}",
        demand_factor=0.7 + index * 0.04,
        renewable_factor=1.4 - index * 0.035,
        accepted_connections_mw=float(index),
        reinforcement_delay_years=index % 3,
    )
    return scenario, PhysicsOutcome(
        scenario_id=scenario.scenario_id,
        input_hash=scenario.input_hash,
        import_capacity_mw=34 + 1.5 * index,
        export_capacity_mw=20,
        feasible=index > 2,
        binding_case="normal",
        binding_constraint="transformer" if index % 2 else "line",
        solver="test-physics",
        solver_version="1",
        validation_class=validation,
        physics_verified=True,
        features={
            "demand_factor": scenario.demand_factor,
            "renewable_factor": scenario.renewable_factor,
            "accepted_connections_mw": scenario.accepted_connections_mw,
            "reinforcement_delay_years": float(scenario.reinforcement_delay_years),
        },
    )


class Release3ShadowTests(unittest.TestCase):
    def test_shadow_observations_are_private_diagnostics(self) -> None:
        training = [outcome(i, prefix="holdout" if i >= 12 else "train")[1] for i in range(15)]
        bundle = train_surrogates(training)
        scenarios, outcomes = zip(*(outcome(i + 4, prefix="shadow") for i in range(4)))
        report = evaluate_shadow_run(
            bundle, list(scenarios), list(outcomes), requested_import_mw=50,
            mandatory_contingencies=set(),
        )
        self.assertFalse(report["capacity_claim"])
        self.assertTrue(all(not row["display_as_capacity"] for row in report["observations"]))
        self.assertTrue(all(row["requires_physics_verification"] for row in report["observations"]))

    def test_synthetic_release_cannot_be_promoted(self) -> None:
        training = [outcome(i, prefix="holdout" if i >= 12 else "train")[1] for i in range(15)]
        scenarios, shadow = zip(*(outcome(i + 2, prefix="shadow") for i in range(6)))
        report = run_release3(
            training_outcomes=training,
            shadow_scenarios=list(scenarios),
            solve_shadow=lambda _: list(shadow),
            requested_import_mw=50,
            mandatory_contingencies=set(),
            operator_reviewed=False,
            operator_training_authorized=False,
        )
        self.assertEqual(report["champion_decision"]["decision"], "retain_challenger")
        self.assertIn("operator_validation_class", report["champion_decision"]["failed_gates"])
        self.assertFalse(report["capacity_claim"])

    def test_synthetic_training_authorisation_fails_closed(self) -> None:
        training = [outcome(i, prefix="holdout" if i >= 12 else "train")[1] for i in range(15)]
        with self.assertRaises(ValueError):
            run_release3(
                training_outcomes=training, shadow_scenarios=[outcome(2, prefix="shadow")[0]],
                solve_shadow=lambda _: [outcome(2, prefix="shadow")[1]],
                requested_import_mw=50, mandatory_contingencies=set(),
                operator_reviewed=False, operator_training_authorized=True,
            )

    def test_drift_flags_features_outside_training_bounds(self) -> None:
        bounds = {key: [0.0, 1.0] for key in (
            "demand_factor", "renewable_factor", "accepted_connections_mw",
            "reinforcement_delay_years", "battery_availability",
            "flexible_load_availability", "battery_dispatch_mw",
            "flexible_load_reduction_mw", "contingency_present", "switching_changed",
            "queue_project_count", "reinforcement_count",
        )}
        report = assess_feature_drift(bounds, [{"demand_factor": 4, "renewable_factor": 0,
            "accepted_connections_mw": 0, "reinforcement_delay_years": 0}])
        self.assertEqual(report["status"], "drift_detected")
        self.assertIn("demand_factor", report["drifted_features"])


if __name__ == "__main__":
    unittest.main()
