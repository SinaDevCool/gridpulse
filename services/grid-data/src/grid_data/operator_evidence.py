from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


USER_AGENT = "GridPulse grid-data/0.1 (+https://gridpulseinsights.com)"


@dataclass(frozen=True)
class OperatorSource:
    source_id: str
    operator: str
    endpoint_key: str
    title: str
    url: str
    source_kind: str
    demand_relevance: str
    legal_boundary: str


OFFICIAL_SOURCES = (
    OperatorSource(
        "50hertz-netzanschluss-2026",
        "50Hertz Transmission GmbH",
        "connection-process",
        "50Hertz grid-connection process",
        "https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss",
        "connection_process",
        "context_only",
        "Non-binding orientation; project-specific operator assessment remains required.",
    ),
    OperatorSource(
        "edis-netzanschluss-public-2026",
        "E.DIS Netz GmbH",
        "generation-monitor",
        "E.DIS Netzanschlussmonitor",
        "https://netzanschlussmonitor.e-dis-netz.de/",
        "connection_map",
        "none",
        "Generation-oriented suggestion only; not evidence of demand headroom.",
    ),
    OperatorSource(
        "edis-netzanschluss-public-2026",
        "E.DIS Netz GmbH",
        "high-voltage-demand",
        "E.DIS high-voltage connection guidance",
        "https://www.e-dis-netz.de/de/energie-anschliessen/gewerbe-und-Industrie/netzanschluss-strom/stromanschluss-in-hochspannung.html",
        "connection_process",
        "context_only",
        "Application guidance only; no project-specific capacity is established.",
    ),
)


class _PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag in {"a", "iframe"}:
            url = values.get("href") or values.get("src")
            if url:
                self.links.append(url)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        normalized = " ".join(data.split())
        if normalized:
            self.text_parts.append(normalized)
            if self._in_title:
                self.title_parts.append(normalized)


def parse_operator_page(source: OperatorSource, body: bytes, retrieved_at: str) -> dict[str, Any]:
    text = body.decode("utf-8", errors="replace")
    parser = _PageParser()
    parser.feed(text)
    normalized_text = " ".join(parser.text_parts)
    capacity_terms = sorted(
        {
            match.group(0).lower()
            for match in re.finditer(
                r"\b(?:netzkapazit[aä]t|anschlussleistung|netzanschluss|verf[uü]gbar\w*)\b",
                normalized_text,
                re.IGNORECASE,
            )
        }
    )
    return {
        "schema_version": "operator-evidence-v1",
        "source": asdict(source),
        "retrieved_at": retrieved_at,
        "http": {"content_bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()},
        "page": {
            "title": " ".join(parser.title_parts),
            "links": sorted(set(parser.links)),
            "capacity_terms_found": capacity_terms,
        },
        "evidence_boundary": source.legal_boundary,
        "capacity_observations": [],
    }


def fetch_operator_sources(output_path: Path) -> dict[str, Any]:
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    records: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for source in OFFICIAL_SOURCES:
        request = urllib.request.Request(source.url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read(5 * 1024 * 1024)
            records.append(parse_operator_page(source, body, retrieved_at))
        except Exception as error:  # a failed source is evidence-health output, not silent success
            errors.append(
                {"endpoint_key": source.endpoint_key, "url": source.url, "error": str(error)}
            )
    report = {
        "schema_version": "operator-evidence-release-v1",
        "retrieved_at": retrieved_at,
        "valid": len(records) == len(OFFICIAL_SOURCES),
        "record_count": len(records),
        "expected_count": len(OFFICIAL_SOURCES),
        "records": records,
        "errors": errors,
        "truth_boundary": (
            "Source discovery and change detection only. No numeric demand capacity is emitted "
            "without an explicit operator value and a reviewed node identity."
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report
