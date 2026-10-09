import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from grid_data.network_study import NetworkModelInput, StudyResult
from grid_data.p0_foundation import PhysicsOutcome, ScenarioDefinition, canonical_hash
from grid_data.p0_p4_publish import publish_pipeline_result
from grid_data.p1_permutation import MemoryResultStore, execute_permutations, generate_permutations
from grid_data.p2_ensemble import (
    convergence,
    correlated_monte_carlo,
    historical_replay,
    stress_scenarios,
    summarize_uncertainty,
)
from grid_data.p3_surrogate import predict, train_surrogates
from grid_data.p4_active_learning import (
    CandidatePrediction,
    promotion_decision,
    select_batch,
    stopping_rule,
)
from grid_data.release2_pipeline import run_release2


class FakePhysics:
    calls = 0

    def _result(self, kind, model):
        self.calls += 1
        load = sum(float(item.get("p_mw", 0)) for item in model.loads)
        capacity = max(0, 100 - load)
        return StudyResult(
            "demonstration",
            kind,
            "fake-ac",
            "1",
            True,
            {
                f"firm_{'import' if kind == 'capacity' else 'export'}_capacity_mw": capacity,
                "binding_case": "base_case",
                "binding_constraint": "line_thermal_loading",
            },
        )

    def calculate_import_capacity(self, model):
        return self._result("capacity", model)

    def calculate_export_capacity(self, model):
        return self._result("export_capacity", model)


def model():
    return NetworkModelInput(
        [],
        [],
        [],
        [{"id": "l", "bus": "b", "p_mw": 10}],
        [],
        [],
        [],
        "b",
        2028,
        {"source_url": "https://simbench.de", "license": "ODbL"},
        "m",
        "v1",
        "synthetic_demonstration",
    )


class PipelineTests(unittest.TestCase):
    def test_private_ledger_publishes_run_and_per_scenario_rows(self):
        class Response:
            status = 201

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

        scenario = ScenarioDefinition("s")
        result = {
            "scenario_count": 1,
            "outcomes": [
                {
                    "scenario_id": "s",
                    "input_hash": scenario.input_hash,
                    "import_capacity_mw": 10,
                    "export_capacity_mw": 5,
                    "binding_case": "base",
                    "binding_constraint": "line",
                    "physics_verified": True,
                    "solver": "ac",
                    "solver_version": "1",
                }
            ],
            "quarantine": [],
            "provenance": {
                "pipeline_version": "v1",
                "model_id": "m",
                "model_version": "1",
                "validation_class": "synthetic_demonstration",
                "dataset_hash": "h",
            },
        }
        with patch("urllib.request.urlopen", return_value=Response()) as opened:
            published = publish_pipeline_result(
                job=SimpleNamespace(id=uuid4(), owner_id=uuid4()),
                result=result,
                scenarios=[scenario],
                supabase_url="https://example.supabase.co",
                service_role_key="secret",
            )
        self.assertEqual({"runs": 1, "results": 1, "models": 0, "release2_records": 0}, published)
        self.assertEqual(2, opened.call_count)

    def test_p0_hash_is_canonical_and_unverified_capacity_fails_closed(self):
        self.assertEqual(canonical_hash({"b": 2, "a": 1}), canonical_hash({"a": 1, "b": 2}))
        item = PhysicsOutcome(
            "x", "h", 10, None, True, None, None, "x", None, "synthetic_demonstration", False
        )
        with self.assertRaises(ValueError):
            item.validate_for_display()

    def test_p1_generates_10000_reproducible_unique_scenarios_and_caches(self):
        dimensions = {
            "demand_factor": [0.5 + index / 100 for index in range(100)],
            "renewable_factor": [index / 100 for index in range(100)],
        }
        first = generate_permutations(dimensions)
        second = generate_permutations(dict(reversed(list(dimensions.items()))))
        self.assertEqual(10000, len(first))
        self.assertEqual([x.input_hash for x in first], [x.input_hash for x in second])
        self.assertEqual(10000, len({x.input_hash for x in first}))
        store, provider = MemoryResultStore(), FakePhysics()
        result = execute_permutations(model(), first[:4], provider, store=store)
        again = execute_permutations(model(), first[:4], provider, store=store)
        self.assertEqual(4, result["solved_count"])
        self.assertEqual(4, again["cache_hits"])
        self.assertIsNotNone(result["firm_import_capacity_mw"])

    def test_p2_preserves_rows_uses_three_years_and_reports_distribution(self):
        rows = [
            {
                "weather_year": year,
                "hour_of_year": hour,
                "demand_factor": 1 + hour / 100,
                "renewable_factor": 0.5 - hour / 100,
            }
            for year in (2021, 2022, 2023)
            for hour in range(2)
        ]
        replay = historical_replay(rows, weather_years={2021, 2022, 2023})
        monte = correlated_monte_carlo(rows, samples=20, seed=7)
        self.assertEqual(6, len(replay))
        self.assertEqual(
            [x.input_hash for x in monte],
            [x.input_hash for x in correlated_monte_carlo(rows, samples=20, seed=7)],
        )
        self.assertEqual(3, len(stress_scenarios()))
        outcomes = [
            PhysicsOutcome(
                x.scenario_id,
                x.input_hash,
                80 + index,
                30,
                True,
                "base",
                "line",
                "ac",
                "1",
                "synthetic_demonstration",
                True,
            )
            for index, x in enumerate(monte)
        ]
        summary = summarize_uncertainty(outcomes, requested_import_mw=90)
        self.assertEqual(20, summary["verified_sample_count"])
        self.assertLess(summary["p10_capacity_mw"], summary["p90_capacity_mw"])
        self.assertTrue(convergence(summary, summary)["stable"])

    def test_p4_keeps_mandatory_contingencies_and_rolls_back_unsafe_model(self):
        candidates = [
            CandidatePrediction(
                ScenarioDefinition(f"s{i}", contingency_id=f"c{i}"), 50 + i, i, i == 4, 0.2
            )
            for i in range(5)
        ]
        selected = select_batch(
            candidates, requested_import_mw=52, batch_size=3, mandatory_contingencies={"c0", "c1"}
        )
        self.assertTrue({"c0", "c1"}.issubset({item.contingency_id for item in selected}))
        self.assertEqual(
            "reject",
            promotion_decision(
                prior_metrics={"capacity_mae_mw": 5},
                new_metrics={"capacity_mae_mw": 4, "false_safe_rate": 0.2},
                false_safe_limit=0.05,
            )["decision"],
        )
        self.assertTrue(
            stopping_rule(
                recent_new_constraints=0,
                percentile_delta_mw=0.1,
                uncertainty_delta_mw=0.1,
                solver_budget_used=20,
                solver_budget=100,
            )["stop"]
        )

    def test_p4_fails_closed_when_mandatory_contingency_is_absent(self):
        candidates = [
            CandidatePrediction(ScenarioDefinition("normal"), 50, 2, False, 0.2)
        ]
        with self.assertRaisesRegex(ValueError, "missing from the candidate pool"):
            select_batch(
                candidates,
                requested_import_mw=52,
                batch_size=1,
                mandatory_contingencies={"required-n-1"},
            )

    def test_p4_rejects_promotion_without_complete_physics_coverage(self):
        decision = promotion_decision(
            prior_metrics={"capacity_mae_mw": 5},
            new_metrics={
                "capacity_mae_mw": 4,
                "false_safe_rate": 0,
                "unique_capacity_labels": 4,
                "capacity_label_range_mw": 10,
            },
            false_safe_limit=0.05,
            physics_coverage=0.75,
            mandatory_contingency_coverage=1.0,
        )
        self.assertEqual("reject", decision["decision"])
        self.assertEqual("incomplete_physics_verification", decision["reason"])

    def test_p3_trains_only_on_verified_physics_and_never_displays_prediction_as_capacity(self):
        rows = []
        for index in range(30):
            features = {
                "demand_factor": 0.7 + index / 50,
                "renewable_factor": 0.2 + (index % 5) / 10,
                "accepted_connections_mw": float(index),
                "reinforcement_delay_years": float(index % 4),
            }
            rows.append(
                PhysicsOutcome(
                    f"{'holdout' if index >= 24 else 'train'}-{index}",
                    str(index),
                    100 - index,
                    30,
                    index < 25,
                    "base",
                    "line" if index % 2 else "transformer",
                    "ac",
                    "1",
                    "synthetic_demonstration",
                    True,
                    features=features,
                )
            )
        rows.append(
            PhysicsOutcome(
                "bad",
                "bad",
                999,
                None,
                True,
                None,
                None,
                "ai",
                None,
                "synthetic_demonstration",
                False,
                features=features,
            )
        )
        bundle = train_surrogates(rows)
        result = predict(bundle, rows[0].features)
        self.assertFalse(result["display_as_capacity"])
        self.assertTrue(result["requires_physics_verification"])
        self.assertFalse(bundle.registry["operator_trained"])
        self.assertNotIn("bad", bundle.registry["dataset_hash"])
        self.assertNotEqual(
            bundle.registry["training_scenario_hash"],
            bundle.registry["holdout_scenario_hash"],
        )
        self.assertIn("false_safe_rate", bundle.registry["metrics"])

    def test_release2_routes_ai_selection_back_through_physics_and_persists_artifact(self):
        rows = []
        for index in range(30):
            features = {
                "demand_factor": 0.7 + index / 50,
                "renewable_factor": 0.2 + (index % 5) / 10,
                "accepted_connections_mw": float(index),
                "reinforcement_delay_years": float(index % 4),
                "requested_import_mw": 70.0,
            }
            rows.append(
                PhysicsOutcome(
                    f"{'holdout' if index >= 24 else 'train'}-{index}",
                    canonical_hash(index),
                    100 - index,
                    30,
                    True,
                    "base",
                    "line" if index % 2 else "transformer",
                    "ac",
                    "1",
                    "synthetic_demonstration",
                    True,
                    features=features,
                )
            )
        candidates = [
            ScenarioDefinition(f"pool-{index}", demand_factor=0.8 + index / 10)
            for index in range(8)
        ]
        candidates[0] = ScenarioDefinition("mandatory", demand_factor=1.4, contingency_id="n-1")

        def outcome(item):
            return PhysicsOutcome(
                item.scenario_id,
                item.input_hash,
                92 - item.demand_factor * 10,
                20,
                True,
                "contingency" if item.contingency_id else "base",
                "transformer",
                "ac",
                "1",
                "synthetic_demonstration",
                True,
                features={
                    "demand_factor": item.demand_factor,
                    "renewable_factor": item.renewable_factor,
                    "accepted_connections_mw": item.accepted_connections_mw,
                    "reinforcement_delay_years": float(item.reinforcement_delay_years),
                    "requested_import_mw": 70.0,
                },
            )

        with TemporaryDirectory() as directory:
            report = run_release2(
                initial_outcomes=rows,
                candidate_scenarios=candidates,
                requested_import_mw=70,
                batch_size=4,
                mandatory_contingencies={"n-1"},
                solve_batch=lambda items: [outcome(item) for item in items],
                solve_one=outcome,
                artifact_path=Path(directory) / "model.joblib",
                solver_budget=8,
            )
            self.assertTrue((Path(directory) / "model.joblib").is_file())
        self.assertIn("mandatory", report["active_learning_round"]["selected_scenario_ids"])
        self.assertEqual(1.0, report["active_learning_round"]["physics_coverage"])
        self.assertEqual(
            1.0, report["active_learning_round"]["mandatory_contingency_coverage"]
        )
        self.assertFalse(report["capacity_claim"])
        self.assertTrue(
            all(
                not item["display_as_capacity"]
                for item in report["active_learning_round"]["predictions"]
            )
        )


if __name__ == "__main__":
    unittest.main()
