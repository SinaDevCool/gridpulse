"""Publish Release C2 source provenance and ensemble results to Supabase."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .publish import SupabasePublisher


def publish_c2_artifact(
    path: Path,
    *,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> dict[str, Any]:
    artifact = json.loads(path.read_text(encoding="utf-8"))
    if artifact.get("schema_version") != "gridpulse-c2-benchmark-v1":
        raise ValueError("Unsupported C2 artifact.")
    if artifact.get("validation_class") != "synthetic_demonstration":
        raise ValueError("Benchmark publication is restricted to synthetic demonstrations.")
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    publisher = SupabasePublisher(url, key)
    public_context = artifact.get("public_context_release")
    public_context_release_id = None
    if public_context:
        context_row = publisher.request(
            "POST",
            "/public_context_releases?on_conflict=release_key,release_sha256&select=id",
            {
                "release_key": "german-hourly-context-2023-2025",
                "release_sha256": public_context["release_sha256"],
                "status": public_context["status"],
                "capacity_claim": False,
                "manifest": public_context,
                "accepted_at": artifact["generated_at"],
            },
            prefer="resolution=merge-duplicates,return=representation",
        )[0]
        public_context_release_id = context_row["id"]
        for report in public_context["sources"]:
            publisher.request(
                "POST",
                "/public_context_quality_reports?on_conflict=release_id,source_key",
                {
                    "release_id": public_context_release_id,
                    "source_key": report["source_key"],
                    "artifact_sha256": report["artifact_sha256"],
                    "parser_version": report["parser_version"],
                    "observation_count": report["observation_count"],
                    "expected_count": report["expected_count"],
                    "coverage": report["coverage"],
                    "duplicate_count": report["duplicate_count"],
                    "missing_count": report["missing_count"],
                    "status": report["status"],
                    "evidence_boundary": report["evidence_boundary"],
                    "issues": report["issues"],
                },
                prefer="resolution=merge-duplicates,return=minimal",
            )
    source_ids = []
    for source in artifact["sources"]:
        row = publisher.request(
            "POST",
            "/hourly_context_releases?on_conflict=source_key,artifact_sha256&select=id",
            {
                "source_key": source["source_key"],
                "metric": source["metric"],
                "unit": source["unit"],
                "source_url": source["provenance"]["source_url"],
                "licence": source["provenance"].get("licence")
                or source["provenance"].get("license"),
                "artifact_sha256": source["provenance"].get("artifact_sha256")
                or artifact["envelope"]["input_sha256"],
                "observation_count": source["observation_count"],
                "provenance": source["provenance"],
                "status": "accepted",
            },
            prefer="resolution=merge-duplicates,return=representation",
        )[0]
        source_ids.append(row["id"])
    mastr_releases = publisher.request(
        "GET",
        "/grid_dataset_releases?source_id=eq.bnetza-mastr-full-export-v1&status=eq.active"
        "&select=id,record_count,validation_report,created_at&order=created_at.desc&limit=1",
    )
    if mastr_releases:
        release = mastr_releases[0]
        validation = release.get("validation_report") or {}
        artifact_sha256 = (
            validation.get("source_sha256")
            or hashlib.sha256(str(release["id"]).encode()).hexdigest()
        )
        mastr_row = publisher.request(
            "POST",
            "/hourly_context_releases?on_conflict=source_key,artifact_sha256&select=id",
            {
                "source_key": "bnetza-mastr-asset-context",
                "metric": "registered_generation_and_storage_context",
                "unit": "registered_assets",
                "source_url": "https://www.marktstammdatenregister.de/MaStR/Datendownload",
                "licence": "MaStR public-data terms",
                "artifact_sha256": artifact_sha256,
                "observation_count": int(release.get("record_count") or 1),
                "provenance": {
                    "publisher": "Bundesnetzagentur Marktstammdatenregister (MaStR)",
                    "dataset_release_id": release["id"],
                    "accepted_at": release.get("created_at"),
                    "evidence_boundary": (
                        "Registered asset context; not dispatch, loading or available capacity."
                    ),
                },
                "status": "accepted",
            },
            prefer="resolution=merge-duplicates,return=representation",
        )[0]
        source_ids.append(mastr_row["id"])
    envelope = artifact["envelope"]
    row = publisher.request(
        "POST",
        "/hourly_capacity_ensembles?on_conflict=model_key,model_version,input_sha256&select=id",
        {
            "model_key": artifact["model"]["id"],
            "model_version": artifact["model"]["version"],
            "validation_class": artifact["validation_class"],
            "target_year": envelope["target_year"],
            "weather_years": envelope["weather_years"],
            "input_sha256": envelope["input_sha256"],
            "source_release_ids": source_ids,
            "summary": {key: value for key, value in envelope.items() if key != "hourly"},
            "hourly": envelope["hourly"],
            "limitations": envelope["limitations"],
            "completed_at": artifact["generated_at"],
        },
        prefer="resolution=merge-duplicates,return=representation",
    )[0]
    return {
        "ensemble_id": row["id"],
        "source_release_ids": source_ids,
        "public_context_release_id": public_context_release_id,
    }
