"""Publish a validated C1 artifact through the server-side Supabase boundary."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .publish import SupabasePublisher


def publish_c1_artifact(
    path: Path,
    *,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> dict[str, Any]:
    artifact = json.loads(path.read_text(encoding="utf-8"))
    if artifact.get("schema_version") != "gridpulse-c1-validation-v1":
        raise ValueError("Unsupported C1 validation artifact.")
    if artifact.get("validation_class") != "synthetic_demonstration":
        raise ValueError("The benchmark publisher accepts synthetic demonstrations only.")
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    publisher = SupabasePublisher(url, key)
    model_rows = publisher.request(
        "POST",
        "/grid_model_versions?on_conflict=model_key,version,model_sha256&select=*",
        {
            "model_key": artifact["model_id"],
            "version": artifact["model_version"],
            "validation_class": artifact["validation_class"],
            "source_name": artifact["provenance"]["source"],
            "source_url": artifact["provenance"]["source_url"],
            "licence": artifact["provenance"]["license"],
            "model_sha256": artifact["model_sha256"],
            "model_format": "simbench-pandapower",
            "element_counts": artifact["element_counts"],
            "provenance": artifact["provenance"],
        },
        prefer="resolution=merge-duplicates,return=representation",
    )
    model_id = model_rows[0]["id"]
    point_rows = publisher.request(
        "POST",
        "/grid_model_connection_points?on_conflict=model_version_id,model_bus_id&select=*",
        {
            "model_version_id": model_id,
            "model_bus_id": artifact["connection_bus"],
            "match_state": "benchmark_only",
            "match_evidence": {
                "geographic_truth": artifact["provenance"]["geographic_truth"],
                "public_label": artifact["public_label"],
            },
        },
        prefer="resolution=merge-duplicates,return=representation",
    )
    point_id = point_rows[0]["id"]
    published = 0
    for result in artifact["results"]:
        publisher.request(
            "POST",
            "/network_study_runs?on_conflict=model_version_id,connection_point_id,study_type,input_sha256",
            {
                "model_version_id": model_id,
                "connection_point_id": point_id,
                "study_type": result["study_type"],
                "status": "succeeded" if result.get("converged") else "failed",
                "validation_class": artifact["validation_class"],
                "solver": result["provider"],
                "solver_version": result["solver_version"],
                "input_sha256": artifact["model_sha256"],
                "assumptions": {
                    "study_year": result["values"].get("study_year"),
                    "connection_bus": artifact["connection_bus"],
                },
                "result": result["values"],
                "limitations": result["limitations"],
                "started_at": artifact["generated_at"],
                "completed_at": artifact["generated_at"],
            },
            prefer="resolution=merge-duplicates,return=minimal",
        )
        published += 1
    return {"model_version_id": model_id, "connection_point_id": point_id, "runs": published}
