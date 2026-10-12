from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

from grid_data.p0_foundation import canonical_hash


@dataclass(frozen=True)
class OperatorReviewEvidence:
    workspace_id: str
    reviewer_id: str
    reviewed_at: str
    agreement_sha256: str
    model_sha256: str
    physics_result_sha256: str
    mandatory_case_recall: float
    constraint_recall: float
    model_reconciled: bool
    operator_signed: bool


def evaluate_promotion(evidence: OperatorReviewEvidence, *, requested_class: str) -> dict[str, Any]:
    if requested_class not in {
        "operator_model_reconciled",
        "operator_reviewed",
        "operator_confirmed",
    }:
        raise ValueError("Unsupported operator validation class.")
    hash_fields = (evidence.agreement_sha256, evidence.model_sha256, evidence.physics_result_sha256)
    checks = {
        "valid_hashes": all(re.fullmatch(r"[a-f0-9]{64}", value) for value in hash_fields),
        "valid_review_time": _valid_time(evidence.reviewed_at),
        "model_reconciled": evidence.model_reconciled,
        "complete_mandatory_recall": evidence.mandatory_case_recall == 1,
        "complete_constraint_recall": evidence.constraint_recall == 1,
        "operator_signature": evidence.operator_signed,
    }
    required = {"valid_hashes", "valid_review_time", "model_reconciled"}
    if requested_class in {"operator_reviewed", "operator_confirmed"}:
        required |= {"complete_mandatory_recall", "complete_constraint_recall"}
    if requested_class == "operator_confirmed":
        required.add("operator_signature")
    accepted = all(checks[key] for key in required)
    payload = {
        "requested_class": requested_class,
        "checks": checks,
        "required_checks": sorted(required),
        "decision": "approved" if accepted else "rejected",
        "evidence": asdict(evidence),
    }
    return {
        **payload,
        "promotion_sha256": canonical_hash(payload),
        "operator_confirmation_created": accepted and requested_class == "operator_confirmed",
    }


def _valid_time(value: str) -> bool:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.tzinfo is not None
    except ValueError:
        return False
