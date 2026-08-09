"""Service-role persistence for private Release 3 shadow validation."""

from __future__ import annotations

import os
from typing import Any

from .publish import SupabasePublisher


def publish_release3(
    *,
    job: Any,
    report: dict[str, Any],
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> dict[str, Any]:
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return {"shadow_run_id": None, "observation_count": 0}
    publisher = SupabasePublisher(url, key)
    shadow = report["shadow"]
    decision = report["champion_decision"]
    technical_gates = {
        key: value
        for key, value in decision["gates"].items()
        if key not in {"operator_reviewed", "operator_training_authorized"}
    }
    row = publisher.request(
        "POST",
        "/grid_shadow_validation_runs?on_conflict=analytics_job_id,report_sha256&select=id",
        {
            "analytics_job_id": str(job.id),
            "owner_id": str(job.owner_id),
            "model_dataset_hash": shadow["model_dataset_hash"],
            "validation_class": shadow["validation_class"],
            "report_sha256": report["report_sha256"],
            "metrics": shadow["metrics"],
            "drift_report": shadow["drift"],
            "feature_importance": shadow["feature_importance"],
            "technical_gates": technical_gates,
            "technical_gates_passed": all(technical_gates.values()),
            "decision": decision["decision"],
            "capacity_claim": False,
            "status": "completed",
        },
        prefer="resolution=merge-duplicates,return=representation",
    )[0]
    run_id = row["id"]
    observations = [
        {
            "shadow_run_id": run_id,
            **item,
            "physics_verified": True,
        }
        for item in shadow["observations"]
    ]
    for start in range(0, len(observations), 500):
        publisher.request(
            "POST",
            "/grid_shadow_observations?on_conflict=shadow_run_id,scenario_sha256",
            observations[start : start + 500],
            prefer="resolution=merge-duplicates,return=minimal",
        )
    return {"shadow_run_id": run_id, "observation_count": len(observations)}
