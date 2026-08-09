"""Synthetic, private Release 3 shadow-validation acceptance benchmark."""

from __future__ import annotations

import json
from pathlib import Path

from .network_state import NetworkStateBuilder
from .network_study import PandapowerProvider
from .p0_foundation import PhysicsOutcome, ScenarioDefinition
from .p1_permutation import execute_permutations
from .pilot_providers import SyntheticPilotDataProvider
from .release3_pipeline import run_release3


def build_release3_benchmark(package_dir: Path, output: Path) -> dict:
    bundle = SyntheticPilotDataProvider(package_dir).load()
    builder = NetworkStateBuilder(bundle)
    provider = PandapowerProvider(maximum_capacity_mw=100, capacity_tolerance_mw=1.0)
    training = [ScenarioDefinition(
        scenario_id=f"{'holdout' if index >= 15 else 'train'}-release3-{index:02d}",
        demand_factor=0.65 + 0.05 * index,
        renewable_factor=0.15 + 0.08 * (index % 8),
        battery_availability=0.5 if index % 4 == 0 else 1,
        accepted_connections_mw=float(index % 6),
    ) for index in range(18)]
    train_result = execute_permutations(bundle.network_model, training, provider, state_builder=builder)
    outcomes = [PhysicsOutcome(**row) for row in train_result["outcomes"]]
    for row in outcomes:
        row.features["requested_import_mw"] = 20
    shadow = [ScenarioDefinition(
        scenario_id=f"shadow-release3-{index:02d}",
        demand_factor=0.72 + 0.035 * index,
        renewable_factor=0.2 + 0.07 * (index % 7),
        accepted_connections_mw=float(index % 5),
        contingency_id=("synthetic-n-1-trafo-1" if index == 0 else
                        "synthetic-n-1-line-a-b" if index == 1 else None),
    ) for index in range(12)]

    def solve(items: list[ScenarioDefinition]) -> list[PhysicsOutcome]:
        result = execute_permutations(bundle.network_model, items, provider, state_builder=builder)
        return [PhysicsOutcome(**row) for row in result["outcomes"]]

    report = run_release3(
        training_outcomes=outcomes, shadow_scenarios=shadow, solve_shadow=solve,
        requested_import_mw=20,
        mandatory_contingencies={"synthetic-n-1-trafo-1", "synthetic-n-1-line-a-b"},
        operator_reviewed=False, operator_training_authorized=False,
    )
    report["benchmark"] = {
        "dataset_id": bundle.manifest.dataset_id,
        "dataset_sha256": bundle.dataset_hash,
        "validation_class": "synthetic_demonstration",
        "operator_data_used": False,
        "expected_decision": "retain_challenger",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return report
