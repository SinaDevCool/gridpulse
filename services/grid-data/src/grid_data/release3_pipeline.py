"""Release 3 training and independent shadow-physics orchestration."""

from __future__ import annotations

from collections.abc import Callable

from .p0_foundation import PhysicsOutcome, ScenarioDefinition
from .p3_surrogate import train_surrogates
from .release3_shadow import release3_report


def run_release3(
    *,
    training_outcomes: list[PhysicsOutcome],
    shadow_scenarios: list[ScenarioDefinition],
    solve_shadow: Callable[[list[ScenarioDefinition]], list[PhysicsOutcome]],
    requested_import_mw: float,
    mandatory_contingencies: set[str],
    operator_reviewed: bool,
    operator_training_authorized: bool,
) -> dict:
    if not training_outcomes:
        raise ValueError("Release 3 requires physics-verified training outcomes.")
    if not shadow_scenarios:
        raise ValueError("Release 3 requires independent shadow scenarios.")
    training_ids = [item.scenario_id for item in training_outcomes]
    training_hashes = [item.input_hash for item in training_outcomes]
    shadow_ids = [item.scenario_id for item in shadow_scenarios]
    shadow_hashes = [item.input_hash for item in shadow_scenarios]
    if len(training_ids) != len(set(training_ids)) or len(training_hashes) != len(
        set(training_hashes)
    ):
        raise ValueError("Release 3 training outcomes must have unique identities and hashes.")
    if len(shadow_ids) != len(set(shadow_ids)) or len(shadow_hashes) != len(set(shadow_hashes)):
        raise ValueError("Release 3 shadow scenarios must have unique identities and hashes.")
    if set(training_ids) & set(shadow_ids) or set(training_hashes) & set(shadow_hashes):
        raise ValueError("Release 3 shadow scenarios must be independent from training data.")
    available_contingencies = {
        item.contingency_id for item in shadow_scenarios if item.contingency_id
    }
    missing_contingencies = sorted(mandatory_contingencies - available_contingencies)
    if missing_contingencies:
        raise ValueError(
            "Mandatory contingencies are absent from the shadow set: "
            + ", ".join(missing_contingencies)
        )
    validation_classes = {item.validation_class for item in training_outcomes}
    if len(validation_classes) != 1:
        raise ValueError("Release 3 training rows must use one validation class.")
    validation_class = next(iter(validation_classes))
    operator_data = validation_class in {"operator_model_reconciled", "operator_reviewed"}
    if operator_training_authorized and not operator_data:
        raise ValueError("Synthetic or unvalidated models cannot be operator-training authorised.")
    bundle = train_surrogates(
        training_outcomes,
        operator_trained=operator_training_authorized and operator_data,
    )
    shadow_outcomes = solve_shadow(shadow_scenarios)
    outcome_ids = [item.scenario_id for item in shadow_outcomes]
    if len(outcome_ids) != len(set(outcome_ids)):
        raise ValueError("Release 3 physics outcomes must have unique scenario identities.")
    scenario_by_id = {item.scenario_id: item for item in shadow_scenarios}
    unknown = sorted(set(outcome_ids) - set(scenario_by_id))
    if unknown:
        raise ValueError("Physics returned outcomes outside the shadow set: " + ", ".join(unknown))
    for item in shadow_outcomes:
        scenario = scenario_by_id[item.scenario_id]
        if item.input_hash != scenario.input_hash:
            raise ValueError(f"Physics outcome hash mismatch for {item.scenario_id}.")
        if item.validation_class != validation_class:
            raise ValueError("Training and shadow outcomes must use one validation class.")
    for item in shadow_outcomes:
        item.features["requested_import_mw"] = requested_import_mw
    report = release3_report(
        bundle,
        shadow_scenarios,
        shadow_outcomes,
        requested_import_mw=requested_import_mw,
        mandatory_contingencies=mandatory_contingencies,
        operator_reviewed=operator_reviewed,
        operator_training_authorized=operator_training_authorized,
    )
    report["model_registry"] = bundle.registry
    report["training_validation_class"] = validation_class
    report["public_visibility"] = "private_internal_only"
    report["capacity_claim"] = False
    return report
