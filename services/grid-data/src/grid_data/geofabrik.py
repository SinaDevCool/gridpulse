from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

GERMANY_PBF_URL = "https://download.geofabrik.de/europe/germany-latest.osm.pbf"
GERMANY_CHECKSUM_URL = f"{GERMANY_PBF_URL}.md5"
USER_AGENT = "GridPulse grid-data/0.1 (+https://gridpulseinsights.com)"


def discover_germany_pbf(output_path: Path) -> dict[str, Any]:
    """Record the immutable-input manifest without downloading the multi-gigabyte extract."""
    request = urllib.request.Request(
        GERMANY_PBF_URL,
        method="HEAD",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        headers = response.headers
        status = getattr(response, "status", 200)

    checksum_request = urllib.request.Request(
        GERMANY_CHECKSUM_URL,
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(checksum_request, timeout=60) as response:
        checksum_text = response.read(1024).decode("ascii", errors="replace").strip()
    expected_md5 = checksum_text.split()[0] if checksum_text else None

    report = {
        "schema_version": "geofabrik-source-manifest-v1",
        "source_id": "geofabrik-germany-osm-pbf-v1",
        "publisher": "Geofabrik GmbH / OpenStreetMap contributors",
        "url": GERMANY_PBF_URL,
        "checksum_url": GERMANY_CHECKSUM_URL,
        "expected_md5": expected_md5,
        "content_length": _integer_header(headers.get("content-length")),
        "etag": headers.get("etag"),
        "last_modified": headers.get("last-modified"),
        "http_status": status,
        "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "licence": "Open Database License (ODbL)",
        "attribution": "© OpenStreetMap contributors",
        "geographic_scope": "Germany",
        "accepted": False,
        "acceptance_boundary": (
            "Discovery only. Download, checksum verification, streaming parse, geometry validation, "
            "deduplication and release promotion are required before national features are visible."
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def _integer_header(value: str | None) -> int | None:
    try:
        return int(value) if value else None
    except ValueError:
        return None
