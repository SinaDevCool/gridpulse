from __future__ import annotations

import os
from typing import Any

from grid_data.publish import SupabasePublisher


def publish_graph_study(*, job: Any, report: dict[str, Any]) -> dict[str, Any]:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return {"graph_study_id": None}
    row = SupabasePublisher(url, key).request(
        "POST",
        "/grid_topology_studies?select=id",
        {
            "analytics_job_id": str(job.id),
            "owner_id": str(job.owner_id),
            "workspace_id": job.input_payload.get("workspace_id"),
            "model_id": report["projection"]["model_id"],
            "model_version": report["projection"]["model_version"],
            "projection_sha256": report["projection"]["projection_sha256"],
            "study_sha256": report["study_sha256"],
            "topology_audit": report["audit"],
            "pathway_summary": report["pathways"],
            "scenario_selection": report["selection"],
            "validation_summary": report["validation_against_full_set"],
            "capacity_claim": False,
            "status": "completed",
        },
        prefer="return=representation",
    )[0]
    return {"graph_study_id": row["id"]}
