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
