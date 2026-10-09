"""Read-only admission policy around the existing rolling planner, not an optimizer."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReplanPolicyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assessed_at: datetime
    previous_accepted_at: datetime | None
    current_fingerprint: str = Field(pattern="^[a-f0-9]{64}$")
    previous_fingerprint: str | None = Field(pattern="^[a-f0-9]{64}$")
    evidence_ready: bool
    safety_violation: bool
    hard_constraints_changed: bool
    projected_improvement_eur: float = Field(ge=0, allow_inf_nan=False)
    minimum_improvement_eur: float = Field(ge=0, allow_inf_nan=False)
    minimum_interval_seconds: int = Field(ge=0, le=86400)

    @model_validator(mode="after")
    def valid_clocks(self):
        for value in (self.assessed_at, self.previous_accepted_at):
            if value is not None and (value.tzinfo is None or value.utcoffset() is None):
                raise ValueError("Replan timestamps require an explicit UTC offset")
        if self.previous_accepted_at is not None and self.previous_accepted_at > self.assessed_at:
            raise ValueError("Previous acceptance cannot follow the assessment cutoff")
        return self


def assess_replan_policy(request: ReplanPolicyRequest) -> dict[str, object]:
    decision, reason = "retain", "unchanged_inputs"
    if not request.evidence_ready:
        decision, reason = "blocked", "evidence_not_ready"
    elif request.safety_violation or request.hard_constraints_changed:
        decision, reason = "recalculate", "safety_or_constraint_change"
    elif request.current_fingerprint != request.previous_fingerprint:
        elapsed = (
            (request.assessed_at - request.previous_accepted_at).total_seconds()
            if request.previous_accepted_at
            else float("inf")
        )
        if request.previous_fingerprint is None:
            decision, reason = "recalculate", "initial_plan"
        elif elapsed < request.minimum_interval_seconds:
            reason = "minimum_replan_interval"
        elif request.projected_improvement_eur < request.minimum_improvement_eur:
            reason = "improvement_below_operator_threshold"
        else:
            decision, reason = "recalculate", "material_input_revision"
    return {
        "decision": decision,
        "reason": reason,
        "automatic_dispatch_authorized": False,
        "threshold_basis": "caller_declared_operator_policy",
        "queues_job": False,
    }
