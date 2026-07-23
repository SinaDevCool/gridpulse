from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class DownloadReport:
    url: str
    path: str
    bytes_downloaded: int
    sha256: str
    retrieved_at: str
    resumed: bool


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_artifact(
    url: str,
    output_path: Path,
    *,
    attempts: int = 4,
    timeout_seconds: int = 120,
) -> DownloadReport:
    """Download an immutable source artifact with retries and HTTP range resume."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = output_path.with_suffix(output_path.suffix + ".part")
    resumed = partial_path.exists() and partial_path.stat().st_size > 0

    for attempt in range(1, attempts + 1):
        offset = partial_path.stat().st_size if partial_path.exists() else 0
        headers = {"User-Agent": "GridPulse grid-data/0.1 (+https://gridpulseinsights.com)"}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                status = getattr(response, "status", 200)
                if offset and status != 206:
                    partial_path.unlink(missing_ok=True)
                    offset = 0
                mode = "ab" if offset and status == 206 else "wb"
                with partial_path.open(mode) as target:
                    while chunk := response.read(4 * 1024 * 1024):
                        target.write(chunk)
            partial_path.replace(output_path)
            break
        except (OSError, TimeoutError, urllib.error.URLError):
            if attempt == attempts:
                raise
            time.sleep(min(2**attempt, 30))

    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    report = DownloadReport(
        url=url,
        path=str(output_path.resolve()),
        bytes_downloaded=output_path.stat().st_size,
        sha256=_sha256(output_path),
        retrieved_at=retrieved_at,
        resumed=resumed,
    )
    manifest_path = output_path.with_suffix(output_path.suffix + ".manifest.json")
    manifest_path.write_text(
        json.dumps(asdict(report), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report
