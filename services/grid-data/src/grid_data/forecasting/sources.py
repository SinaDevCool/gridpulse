from __future__ import annotations

import hashlib
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone

from .contracts import EvidenceType, Observation


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_entsoe_document(
    content: bytes,
    *,
    metric_key: str,
    unit: str,
    source_url: str,
    retrieved_at: datetime | None = None,
) -> list[Observation]:
    """Parse ENTSO-E Period/Point XML without depending on one document namespace."""
    root = ET.fromstring(content)
    retrieved = retrieved_at or datetime.now(timezone.utc)
    digest = sha256_bytes(content)
    observations: list[Observation] = []
    for period in (node for node in root.iter() if _local_name(node.tag) == "Period"):
        interval = next((n for n in period if _local_name(n.tag) == "timeInterval"), None)
        resolution = next((n.text for n in period if _local_name(n.tag) == "resolution"), None)
        if interval is None or resolution not in {"PT15M", "PT30M", "PT60M"}:
            continue
        start_text = next(n.text for n in interval if _local_name(n.tag) == "start")
        start = datetime.fromisoformat(start_text.replace("Z", "+00:00"))
        minutes = {"PT15M": 15, "PT30M": 30, "PT60M": 60}[resolution]
        for point in (n for n in period if _local_name(n.tag) == "Point"):
            values = {_local_name(n.tag): n.text for n in point}
            position = int(values["position"])
            value_text = values.get("quantity") or values.get("price.amount")
            if value_text is None:
                continue
            interval_start = start + timedelta(minutes=minutes * (position - 1))
            observations.append(Observation(
                metric_key=metric_key,
                interval_start=interval_start,
                interval_end=interval_start + timedelta(minutes=minutes),
                value=float(value_text), unit=unit, source_key="entsoe-transparency",
                source_url=source_url, retrieved_at=retrieved, content_hash=digest,
                source_record_id=f"{start.isoformat()}:{position}",
            ))
    return observations


def fetch_entsoe(
    *, token: str, document_type: str, period_start: datetime, period_end: datetime,
    domain: str = "10Y1001A1001A82H", metric_key: str, unit: str,
) -> list[Observation]:
    if not token:
        raise ValueError("ENTSOE_SECURITY_TOKEN is required server-side")
    params = {
        "securityToken": token, "documentType": document_type,
        "in_Domain": domain, "out_Domain": domain,
        "periodStart": period_start.strftime("%Y%m%d%H%M"),
        "periodEnd": period_end.strftime("%Y%m%d%H%M"),
    }
    url = "https://web-api.tp.entsoe.eu/api?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as response:
        content = response.read()
    return parse_entsoe_document(content, metric_key=metric_key, unit=unit, source_url=url.split("securityToken=")[0])


def parse_smard_rows(
    rows: Iterable[dict[str, object]], *, metric_key: str, unit: str, source_url: str,
    retrieved_at: datetime | None = None,
) -> list[Observation]:
    retrieved = retrieved_at or datetime.now(timezone.utc)
    material = json.dumps(list(rows), sort_keys=True, default=str).encode()
    parsed = json.loads(material)
    digest = sha256_bytes(material)
    result: list[Observation] = []
    for row in parsed:
        timestamp = row.get("timestamp") or row.get("interval_start")
        value = row.get("value")
        if timestamp is None or value is None:
            continue
        start = datetime.fromtimestamp(float(timestamp) / 1000, timezone.utc) if isinstance(timestamp, (int, float)) else datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
        result.append(Observation(metric_key, start, start + timedelta(hours=1), float(value), unit, "smard", source_url, retrieved, digest))
    return result


def dwd_capture_manifest(*, url: str, content: bytes, retrieved_at: datetime | None = None) -> dict[str, object]:
    """Immutable provenance for a DWD forecast file captured before delivery."""
    retrieved = retrieved_at or datetime.now(timezone.utc)
    return {"sourceKey": "dwd-open-forecast", "sourceUrl": url, "retrievedAt": retrieved.isoformat(),
            "contentSha256": sha256_bytes(content), "byteSize": len(content), "evidenceType": EvidenceType.PUBLIC_FORECAST.value}
