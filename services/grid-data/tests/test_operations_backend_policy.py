import pytest

from grid_data.api.replan_policy import ReplanPolicyRequest, assess_replan_policy
from grid_data.api.request_limits import OperationsBodyLimit


def policy(**updates):
    return ReplanPolicyRequest.model_validate(
        {
            "assessed_at": "2026-10-10T10:00:00Z",
            "previous_accepted_at": "2026-10-10T09:59:00Z",
            "current_fingerprint": "b" * 64,
            "previous_fingerprint": "a" * 64,
            "evidence_ready": True,
            "safety_violation": False,
            "hard_constraints_changed": False,
            "projected_improvement_eur": 50,
            "minimum_improvement_eur": 100,
            "minimum_interval_seconds": 300,
            **updates,
        }
    )


def test_hysteresis_limits_churn_but_safety_changes_force_reassessment():
    assert assess_replan_policy(policy())["reason"] == "minimum_replan_interval"
    assert assess_replan_policy(policy(safety_violation=True))["decision"] == "recalculate"
    assert assess_replan_policy(policy(hard_constraints_changed=True))["decision"] == "recalculate"
    assert (
        assess_replan_policy(policy(evidence_ready=False, safety_violation=True))["decision"]
        == "blocked"
    )
    assert (
        assess_replan_policy(policy(previous_accepted_at="2026-10-10T09:00:00Z"))["reason"]
        == "improvement_below_operator_threshold"
    )
    assert (
        assess_replan_policy(
            policy(previous_accepted_at="2026-10-10T09:00:00Z", projected_improvement_eur=150)
        )["decision"]
        == "recalculate"
    )


def test_policy_does_not_claim_to_execute_or_queue_jobs():
    result = assess_replan_policy(policy(safety_violation=True))
    assert result["automatic_dispatch_authorized"] is False
    assert result["queues_job"] is False
    with pytest.raises(ValueError, match="UTC offset"):
        policy(assessed_at="2026-10-10T10:00:00")


def test_streamed_asgi_payload_is_bounded_without_content_length():
    import asyncio

    invoked = []
    sent = []

    async def app(scope, receive, send):
        invoked.append(True)

    messages = iter(
        [
            {"type": "http.request", "body": b"123456", "more_body": True},
            {"type": "http.request", "body": b"789012", "more_body": False},
        ]
    )

    async def receive():
        return next(messages)

    async def send(message):
        sent.append(message)

    asyncio.run(
        OperationsBodyLimit(app, maximum_bytes=10)(
            {"type": "http", "method": "POST", "path": "/v1/jobs/facility-plan"}, receive, send
        )
    )
    assert not invoked
    assert sent[0]["status"] == 413
