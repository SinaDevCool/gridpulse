from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

GERMANY_INDEX_URL = "https://download.geofabrik.de/europe/germany.html"
USER_AGENT = "GridPulse grid-data/0.1 (+https://gridpulseinsights.com)"

# Geofabrik publishes these as independent extracts.  Bremen is included in
# Niedersachsen and Saarland in Rheinland-Pfalz; the manifest records that
# explicitly so an aggregate never double counts a state.
STATE_EXTRACTS = {
    "baden-wuerttemberg": ("Baden-Württemberg",),
    "bayern": ("Bayern",),
    "berlin": ("Berlin",),
    "brandenburg": ("Brandenburg",),
    "hamburg": ("Hamburg",),
    "hessen": ("Hessen",),
    "mecklenburg-vorpommern": ("Mecklenburg-Vorpommern",),
    "niedersachsen": ("Niedersachsen", "Bremen"),
    "nordrhein-westfalen": ("Nordrhein-Westfalen",),
    "rheinland-pfalz": ("Rheinland-Pfalz", "Saarland"),
    "sachsen": ("Sachsen",),
    "sachsen-anhalt": ("Sachsen-Anhalt",),
    "schleswig-holstein": ("Schleswig-Holstein",),
    "thueringen": ("Thüringen",),
}


def discover_germany_pbf(output_path: Path) -> dict[str, Any]:
    """Record the immutable-input manifest without downloading the multi-gigabyte extract."""
    # The rolling PBF alias does not always have a matching .md5 endpoint.
    # Pin both files to the same dated release advertised by the publisher.
    index_request = urllib.request.Request(GERMANY_INDEX_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(index_request, timeout=60) as response:
        index_html = response.read(1_000_000).decode("utf-8", errors="replace")
    files = set(re.findall(r"""href=["'](germany-\d{6}\.osm\.pbf(?:\.md5)?)["']""", index_html))
    releases = sorted(name for name in files if name.endswith(".osm.pbf"))
    if not releases:
        raise RuntimeError("Geofabrik did not advertise a dated Germany PBF release")
    filename = releases[-1]
    if f"{filename}.md5" not in files:
        raise RuntimeError(f"Geofabrik checksum is missing for {filename}")
    pbf_url = f"https://download.geofabrik.de/europe/{filename}"
    checksum_url = f"{pbf_url}.md5"
    request = urllib.request.Request(
        pbf_url,
        method="HEAD",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        headers = response.headers
        status = getattr(response, "status", 200)

    checksum_request = urllib.request.Request(
        checksum_url,
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(checksum_request, timeout=60) as response:
        checksum_text = response.read(1024).decode("ascii", errors="replace").strip()
    checksum_fields = checksum_text.split()
    if (
        len(checksum_fields) != 2
        or not re.fullmatch(r"[a-fA-F0-9]{32}", checksum_fields[0])
        or checksum_fields[1].lstrip("*") != filename
    ):
        raise RuntimeError(f"invalid Geofabrik checksum for {filename}")
    expected_md5 = checksum_fields[0].lower()

    report = {
        "schema_version": "geofabrik-source-manifest-v1",
        "source_id": "geofabrik-germany-osm-pbf-v1",
        "publisher": "Geofabrik GmbH / OpenStreetMap contributors",
        "url": pbf_url,
        "checksum_url": checksum_url,
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


def state_pbf_url(slug: str) -> str:
    if slug not in STATE_EXTRACTS:
        raise ValueError(f"unsupported Geofabrik state extract: {slug}")
    return f"https://download.geofabrik.de/europe/germany/{slug}-latest.osm.pbf"


def discover_state_manifest(output_path: Path) -> dict[str, Any]:
    """Discover every bounded German extract and write a resumable manifest."""
    extracts = []
    for slug, states in STATE_EXTRACTS.items():
        url = state_pbf_url(slug)
        head = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(head, timeout=60) as response:
            headers = response.headers
        checksum_request = urllib.request.Request(f"{url}.md5", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(checksum_request, timeout=60) as response:
            checksum = response.read(1024).decode("ascii", errors="replace").split()[0]
        if not re.fullmatch(r"[a-fA-F0-9]{32}", checksum):
            raise RuntimeError(f"invalid Geofabrik checksum for {slug}")
        extracts.append(
            {
                "slug": slug,
                "federal_states": list(states),
                "url": url,
                "expected_md5": checksum.lower(),
                "content_length": _integer_header(headers.get("content-length")),
                "etag": headers.get("etag"),
                "last_modified": headers.get("last-modified"),
                "status": "discovered",
            }
        )
    report = {
        "schema_version": "geofabrik-germany-state-manifest-v1",
        "source_id": "geofabrik-germany-osm-pbf-v1",
        "publisher": "Geofabrik GmbH / OpenStreetMap contributors",
        "licence": "Open Database License (ODbL)",
        "attribution": "© OpenStreetMap contributors",
        "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "federal_states": sorted({state for item in extracts for state in item["federal_states"]}),
        "extracts": extracts,
        "accepted": False,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def verify_pbf(path: Path, expected_md5: str) -> str:
    """Verify a downloaded extract before parsing it."""
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual.casefold() != expected_md5.casefold():
        raise ValueError(
            f"checksum mismatch for {path.name}: expected {expected_md5}, got {actual}"
        )
    return actual


def _integer_header(value: str | None) -> int | None:
    try:
        return int(value) if value else None
    except ValueError:
        return None
