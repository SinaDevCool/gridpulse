"""Synthetic, private Release 3 shadow-validation acceptance benchmark."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .network_state import NetworkStateBuilder
from .network_study import PandapowerProvider
from .p0_foundation import PhysicsOutcome, ScenarioDefinition
from .p1_permutation import execute_permutations
from .pilot_providers import SyntheticPilotDataProvider
from .release3_pipeline import run_release3


def build_release3_benchmark(
    package_dir: Path, output: Path, public_output: Path | None = None
) -> dict:
    bundle = SyntheticPilotDataProvider(package_dir).load()
    builder = NetworkStateBuilder(bundle)
    provider = PandapowerProvider(maximum_capacity_mw=100, capacity_tolerance_mw=1.0)
    training = [
        ScenarioDefinition(
            scenario_id=f"{'holdout' if index >= 28 else 'train'}-release3-{index:02d}",
            demand_factor=0.65 + 0.025 * index,
            renewable_factor=0.15 + 0.08 * (index % 8),
            battery_availability=0.5 if index % 4 == 0 else 1,
            accepted_connections_mw=float(index % 8),
            contingency_id=(
                "synthetic-n-1-trafo-1"
                if index in {4, 30}
                else "synthetic-n-1-line-a-b"
                if index in {12, 31}
                else None
            ),
        )
        for index in range(36)
    ]
    train_result = execute_permutations(
        bundle.network_model, training, provider, state_builder=builder
    )
    outcomes = [PhysicsOutcome(**row) for row in train_result["outcomes"]]
    for row in outcomes:
        row.features["requested_import_mw"] = 20
    shadow = [
        ScenarioDefinition(
            scenario_id=f"shadow-release3-{index:02d}",
            demand_factor=0.68 + 0.017 * index,
            renewable_factor=0.18 + 0.075 * (index % 8),
            accepted_connections_mw=float(index % 7),
            contingency_id=(
                "synthetic-n-1-trafo-1"
                if index == 0
                else "synthetic-n-1-line-a-b"
                if index == 1
                else None
            ),
        )
        for index in range(36)
    ]

    def solve(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
        result = execute_permutations(bundle.network_model, items, provider, state_builder=builder)
        return [PhysicsOutcome(**row) for row in result["outcomes"]]

    report = run_release3(
        training_outcomes=outcomes,
        shadow_scenarios=shadow,
        solve_shadow=solve,
        requested_import_mw=20,
        mandatory_contingencies={"synthetic-n-1-trafo-1", "synthetic-n-1-line-a-b"},
        operator_reviewed=False,
        operator_training_authorized=False,
    )
    report["benchmark"] = {
        "dataset_id": bundle.manifest.dataset_id,
        "dataset_sha256": bundle.dataset_hash,
        "validation_class": "synthetic_demonstration",
        "operator_data_used": False,
        "expected_decision": "retain_challenger",
        "reproducibility_command": "npm run grid:validate:r3",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    if public_output:
        metrics = report["shadow"]["metrics"]
        decision = report["champion_decision"]
        public_manifest = {
            "schema_version": "gridpulse-release3-governance-v1",
            "release": "Release 3",
            "validation_class": report["shadow"]["validation_class"],
            "public_visibility": "governance_summary_only",
            "capacity_claim": False,
            "dataset": report["benchmark"],
            "shadow": {
                "scenario_count": metrics["scenario_count"],
                "verified_count": metrics["verified_count"],
                "physics_coverage": metrics["physics_coverage"],
                "mae_mw": metrics["mae_mw"],
                "p95_absolute_error_mw": metrics["p95_absolute_error_mw"],
                "bias_mw": metrics["bias_mw"],
                "false_safe_rate": metrics["false_safe_rate"],
                "out_of_distribution_rate": metrics["out_of_distribution_rate"],
                "binding_accuracy": metrics["binding_accuracy"],
                "mandatory_contingency_coverage": metrics["mandatory_contingency_coverage"],
                "unverified_scenario_count": metrics["unverified_scenario_count"],
                "drift_status": report["shadow"]["drift"]["status"],
                "model_dataset_hash": report["shadow"]["model_dataset_hash"],
            },
            "champion_decision": decision,
            "operator_requirements": {
                "accepted_model": True,
                "signed_training_permission": True,
                "operator_review": True,
            },
            "private_observations_published": False,
            "private_predictions_published": False,
            "report_sha256": report["report_sha256"],
            "reproducibility": {
                "command": "npm run grid:validate:r3",
                "random_state": report["model_registry"]["random_state"],
                "split_method": report["model_registry"]["split_method"],
                "training_scenario_hash": report["model_registry"][
                    "training_scenario_hash"
                ],
                "holdout_scenario_hash": report["model_registry"][
                    "holdout_scenario_hash"
                ],
                "shadow_scenario_hash": hashlib.sha256(
                    json.dumps(
                        sorted(item.input_hash for item in shadow),
                        separators=(",", ":"),
                    ).encode()
                ).hexdigest(),
            },
            "public_capacity_boundary": {
                "surrogate_applied_to_public_capacity": False,
                "map_values_remain_physics_results": True,
                "operator_confirmation_created": False,
                "status": "private_shadow_validation_only",
            },
            "warning": report["warning"],
        }
        public_manifest["manifest_sha256"] = hashlib.sha256(
            json.dumps(public_manifest, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        public_output.parent.mkdir(parents=True, exist_ok=True)
        public_output.write_text(json.dumps(public_manifest, indent=2), encoding="utf-8")
    return report
