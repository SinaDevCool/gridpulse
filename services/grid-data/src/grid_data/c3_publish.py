"""Persist a versioned C3 benchmark in Supabase."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .publish import SupabasePublisher


def publish_c3_artifact(
    path: Path, *, supabase_url: str | None = None, service_role_key: str | None = None
) -> dict[str, Any]:
    artifact = json.loads(path.read_text(encoding="utf-8"))
    if (
        artifact.get("schema_version") != "gridpulse-c3-benchmark-v1"
        or artifact.get("validation_class") != "synthetic_demonstration"
    ):
        raise ValueError("Only a C3 synthetic benchmark artifact may be published.")
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    publisher = SupabasePublisher(url, key)
    row = publisher.request(
        "POST",
        "/c3_security_flexibility_runs?on_conflict=model_key,model_version,limits_sha256&select=id",
        {
            "model_key": artifact["model"]["id"],
            "model_version": artifact["model"]["version"],
            "validation_class": artifact["validation_class"],
            "limits_sha256": artifact["fca"]["dynamic"]["limits_sha256"],
            "security": artifact["security"],
            "flexibility_summary": artifact["flexibility"]["summary"],
            "hourly_dispatch": artifact["flexibility"]["hourly"],
            "fca_proposals": artifact["fca"],
            "sources": artifact["sources"],
            "limitations": artifact["flexibility"]["limitations"] + [artifact["evidence_boundary"]],
            "completed_at": artifact["generated_at"],
        },
        prefer="resolution=merge-duplicates,return=representation",
    )[0]
    return {"c3_run_id": row["id"]}
