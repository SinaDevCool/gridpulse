from __future__ import annotations

import json
import os
from pathlib import Path

from .publish import SupabasePublisher


def publish_operator_health(
    input_path: Path,
    *,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> dict[str, int]:
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    report = json.loads(input_path.read_text(encoding="utf-8"))
    client = SupabasePublisher(url, key)
    published = 0
    failed = 0
    for record in report.get("records", []):
        source = record["source"]
        http = record["http"]
        client.request(
            "POST",
            "/rpc/record_operator_source_check",
            {
                "p_endpoint_key": source["endpoint_key"],
                "p_source_id": source["source_id"],
                "p_http_status": http.get("status"),
                "p_content_sha256": http["sha256"],
                "p_content_length": http["content_bytes"],
                "p_etag": http.get("etag"),
                "p_last_modified": http.get("last_modified"),
                "p_connector_version": "operator-evidence-v1",
                "p_error": None,
            },
        )
        published += 1
    for error in report.get("errors", []):
        matching = next(
            (
                source
                for source in report.get("records", [])
                if source["source"]["endpoint_key"] == error["endpoint_key"]
            ),
            None,
        )
        source_id = (
            matching["source"]["source_id"] if matching else _source_id(error["endpoint_key"])
        )
        client.request(
            "POST",
            "/rpc/record_operator_source_check",
            {
                "p_endpoint_key": error["endpoint_key"],
                "p_source_id": source_id,
                "p_http_status": None,
                "p_content_sha256": None,
                "p_content_length": None,
                "p_etag": None,
                "p_last_modified": None,
                "p_connector_version": "operator-evidence-v1",
                "p_error": error["error"][:2000],
            },
        )
        failed += 1
    return {"published": published, "failed": failed}


def _source_id(endpoint_key: str) -> str:
    if endpoint_key.startswith(("generation", "high-voltage")):
        return "edis-netzanschluss-public-2026"
    return "50hertz-netzanschluss-2026"
