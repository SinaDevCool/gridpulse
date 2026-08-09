"""Deterministic synthetic Release 2 acceptance benchmark."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .network_state import NetworkStateBuilder
from .network_study import PandapowerProvider
from .p0_foundation import PhysicsOutcome, ScenarioDefinition
from .p1_permutation import execute_permutations
from .pilot_providers import SyntheticPilotDataProvider
from .release2_pipeline import run_release2


def build_release2_benchmark(
    package_dir: Path, output: Path, model_artifact: Path, public_output: Path | None = None
) -> dict:
    bundle = SyntheticPilotDataProvider(package_dir).load()
    builder = NetworkStateBuilder(bundle)
    provider = PandapowerProvider(maximum_capacity_mw=100, capacity_tolerance_mw=1.0)
    initial = []
    index = 0
    for demand in (0.7, 0.85, 1.0, 1.15, 1.3, 1.45):
        for renewable in (0.2, 0.8, 1.4):
            prefix = "holdout" if index >= 14 else "train"
            initial.append(
                ScenarioDefinition(
                    f"{prefix}-release2-{index:02d}",
                    demand_factor=demand,
                    renewable_factor=renewable,
                    battery_availability=1.0 if index % 4 else 0.5,
                    flexible_load_availability=1.0 if index % 5 else 0.5,
                    source_kind="synthetic_benchmark",
                )
            )
            index += 1
    initial_result = execute_permutations(
        bundle.network_model, initial, provider, state_builder=builder
    )
    outcomes = [PhysicsOutcome(**item) for item in initial_result["outcomes"]]
    for item in outcomes:
        item.features["requested_import_mw"] = 20.0
    candidates = [
        ScenarioDefinition(
            "release2-mandatory-trafo",
            demand_factor=1.35,
            renewable_factor=0.15,
            contingency_id="synthetic-n-1-trafo-1",
            source_kind="stress",
        ),
        ScenarioDefinition(
            "release2-mandatory-line",
            demand_factor=1.3,
            renewable_factor=0.2,
            contingency_id="synthetic-n-1-line-a-b",
            source_kind="stress",
        ),
    ] + [
        ScenarioDefinition(
            f"release2-pool-{item}",
            demand_factor=0.65 + item * 0.13,
            renewable_factor=max(0.0, 1.5 - item * 0.17),
            accepted_connections_mw=float(item * 2),
            source_kind="active_learning_pool",
        )
        for item in range(8)
    ]

    def solve(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
        result = execute_permutations(bundle.network_model, items, provider, state_builder=builder)
        solved = [PhysicsOutcome(**item) for item in result["outcomes"]]
        for row in solved:
            row.features["requested_import_mw"] = 20.0
        return solved

    def solve_one(item: ScenarioDefinition) -> PhysicsOutcome:
        rows = solve([item])
        if not rows:
            raise RuntimeError("Synthetic Release 2 benchmark solver produced no verified row.")
        return rows[0]

    report = run_release2(
        initial_outcomes=outcomes,
        candidate_scenarios=candidates,
        requested_import_mw=20,
        batch_size=6,
        mandatory_contingencies={
            "synthetic-n-1-trafo-1",
            "synthetic-n-1-line-a-b",
        },
        solve_batch=solve,
        solve_one=solve_one,
        artifact_path=model_artifact,
        solver_budget=12,
    )
    report["benchmark"] = {
        "dataset_id": bundle.manifest.dataset_id,
        "dataset_sha256": bundle.dataset_hash,
        "validation_class": "synthetic_demonstration",
        "physics_training_rows": len(outcomes),
        "electrical_model": bundle.network_model.model_id,
        "operator_data_used": False,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    if public_output:
        registry = report["updated_model_registry"]
        public_manifest = {
            "schema_version": "gridpulse-release2-governance-v1",
            "release": "Release 2",
            "validation_class": "synthetic_demonstration",
            "public_visibility": "governance_summary_only",
            "capacity_claim": False,
            "dataset": report["benchmark"],
            "model": {
                "algorithm": registry["algorithm"],
                "training_count": registry["training_count"],
                "holdout_count": registry["holdout_count"],
                "unique_capacity_labels": registry["metrics"]["unique_capacity_labels"],
                "capacity_label_range_mw": registry["metrics"]["capacity_label_range_mw"],
                "capacity_mae_mw": registry["metrics"]["capacity_mae_mw"],
                "false_safe_rate": registry["metrics"]["false_safe_rate"],
                "dataset_hash": registry["dataset_hash"],
                "approved_use": registry["approved_use"],
                "prohibited_use": registry["prohibited_use"],
            },
            "active_learning": {
                "candidate_count": report["active_learning_round"]["candidate_count"],
                "physics_selected_count": report["active_learning_round"]["selected_count"],
                "mandatory_contingency_count": len(
                    report["active_learning_round"]["mandatory_contingencies"]
                ),
                "physics_verified_selected_count": len(
                    report["active_learning_round"]["physics_outcomes"]
                ),
                "rare_event_verified_count": report["rare_event_search"]["verified_count"],
                "selected_scenario_hash": report["active_learning_round"]["selected_scenario_hash"],
            },
            "promotion": report["promotion"],
            "stopping": report["stopping"],
            "artifact": {
                "sha256": report["artifact"]["artifact_sha256"],
                "publicly_downloadable": False,
                "format_disclosed": False,
            },
            "warning": report["warning"],
        }
        public_manifest["manifest_sha256"] = hashlib.sha256(
            json.dumps(public_manifest, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        public_output.parent.mkdir(parents=True, exist_ok=True)
        public_output.write_text(json.dumps(public_manifest, indent=2), encoding="utf-8")
    return report
