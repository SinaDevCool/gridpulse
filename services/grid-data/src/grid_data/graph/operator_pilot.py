from __future__ import annotations

from dataclasses import dataclass

from .contracts import GraphProjection


@dataclass(frozen=True)
class OperatorGraphAuthorization:
    workspace_id: str
    topology_processing_allowed: bool
    derived_metrics_allowed: bool
    model_training_allowed: bool
    agreement_sha256: str


def validate_operator_projection(
    projection: GraphProjection, authorization: OperatorGraphAuthorization | None
) -> dict:
    operator_model = projection.validation_class in {
        "operator_model_unvalidated",
        "operator_model_reconciled",
        "operator_reviewed",
    }
    if operator_model and (not authorization or not authorization.topology_processing_allowed):
        raise PermissionError("Operator topology requires explicit processing authorization.")
    return {
        "workspace_id": authorization.workspace_id if authorization else None,
        "operator_data": operator_model,
        "derived_metrics_allowed": bool(authorization and authorization.derived_metrics_allowed),
        "model_training_allowed": bool(authorization and authorization.model_training_allowed),
        "operator_confirmation_created": False,
        "capacity_claim": False,
    }
