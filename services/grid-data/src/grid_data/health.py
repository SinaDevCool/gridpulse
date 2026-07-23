from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MASTR_DOWNLOAD_PAGE = "https://www.marktstammdatenregister.de/MaStR/Datendownload"
_EXPORT_PATTERN = re.compile(
    r"https://download\.marktstammdatenregister\.de/Gesamtdatenexport_[0-9_]+\.[0-9]+\.zip"
)


def discover_mastr_export(output_path: Path) -> dict[str, Any]:
    request = urllib.request.Request(
        MASTR_DOWNLOAD_PAGE,
        headers={"User-Agent": "GridPulse grid-data/0.1 (+https://gridpulseinsights.com)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        page = response.read(2 * 1024 * 1024).decode("utf-8", errors="replace")
    match = _EXPORT_PATTERN.search(page)
    if not match:
        raise RuntimeError("current MaStR export link was not found")
    return check_source(match.group(0), output_path)


def check_source(url: str, output_path: Path) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": "GridPulse grid-data/0.1 (+https://gridpulseinsights.com)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        result = {
            "url": url,
            "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "status": getattr(response, "status", 200),
            "content_length": int(response.headers.get("content-length", "0") or 0),
            "etag": response.headers.get("etag"),
            "last_modified": response.headers.get("last-modified"),
            "content_type": response.headers.get("content-type"),
        }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return result
