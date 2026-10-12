"""Free German time-series adapters used by Release C2.

The adapters deliberately preserve the distinction between national context,
weather observations, registered assets and operator network measurements.
None of these sources is treated as substation loading or available capacity.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SMARD_BASE_URL = "https://www.smard.de/app/chart_data"
SMARD_SOURCE_URL = "https://www.smard.de/en/datennutzung"
DWD_TEMPERATURE_URL = (
    "https://opendata.dwd.de/climate_environment/CDC/observations_germany/"
    "climate/hourly/air_temperature/historical/"
)
MASTR_SOURCE_URL = "https://www.marktstammdatenregister.de/MaStR/Datendownload"

SMARD_SOURCE_KEYS = {
    "actual_grid_load": "bnetza-smard-grid-load",
    "day_ahead_price": "bnetza-smard-day-ahead-price",
    "wind_onshore_generation": "bnetza-smard-wind-onshore",
    "wind_offshore_generation": "bnetza-smard-wind-offshore",
    "solar_generation": "bnetza-smard-solar-generation",
    "load_forecast": "bnetza-smard-load-forecast",
}


def smard_source_key(metric: str) -> str:
    try:
        return SMARD_SOURCE_KEYS[metric]
    except KeyError as exc:
        raise ValueError(f"Unsupported SMARD metric: {metric}") from exc


@dataclass(frozen=True)
class HourlySeries:
    source_key: str
    metric: str
    unit: str
    values: tuple[tuple[datetime, float], ...]
    provenance: dict[str, Any]

    def year(self, year: int) -> HourlySeries:
        return HourlySeries(
            self.source_key,
            self.metric,
            self.unit,
            tuple(item for item in self.values if item[0].year == year),
            self.provenance,
        )


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def fetch_smard_hourly(
    *,
    filter_id: int = 410,
    region: str = "DE",
    start_year: int | None = None,
    end_year: int | None = None,
    metric: str = "actual_grid_load",
    unit: str = "MWh_per_hour",
) -> HourlySeries:
    """Fetch SMARD hourly blocks; filter 410 is actual grid load.

    SMARD does not publish feeder or substation loading through this endpoint.
    The series is used only to scale representative system operating cases.
    """
    index_url = f"{SMARD_BASE_URL}/{filter_id}/{region}/index_hour.json"
    with urllib.request.urlopen(index_url, timeout=60) as response:
        index_bytes = response.read()
    timestamps = json.loads(index_bytes)["timestamps"]
    rows: dict[int, float] = {}
    block_hashes: list[str] = []
    for timestamp in timestamps:
        year = datetime.fromtimestamp(timestamp / 1000, timezone.utc).year
        if start_year is not None and year < start_year:
            continue
        if end_year is not None and year > end_year:
            continue
        url = f"{SMARD_BASE_URL}/{filter_id}/{region}/{filter_id}_{region}_hour_{timestamp}.json"
        with urllib.request.urlopen(url, timeout=60) as response:
            content = response.read()
        block_hashes.append(_sha256(content))
        for epoch_ms, value in json.loads(content).get("series", []):
            if value is not None:
                rows[int(epoch_ms)] = float(value)
    values = tuple(
        (datetime.fromtimestamp(epoch / 1000, timezone.utc), value)
        for epoch, value in sorted(rows.items())
        if (
            start_year is None
            or datetime.fromtimestamp(epoch / 1000, timezone.utc).year >= start_year
        )
        and (
            end_year is None or datetime.fromtimestamp(epoch / 1000, timezone.utc).year <= end_year
        )
    )
    if not values:
        raise ValueError("SMARD returned no hourly observations for the requested years.")
    source_key = smard_source_key(metric)
    return HourlySeries(
        source_key,
        metric,
        unit,
        values,
        {
            "publisher": "Bundesnetzagentur | SMARD.de",
            "source_url": SMARD_SOURCE_URL,
            "endpoint": index_url,
            "licence": "CC-BY-4.0",
            "filter_id": filter_id,
            "region": region,
            "artifact_sha256": _sha256("".join(block_hashes).encode()),
            "evidence_boundary": "German system context; not node or feeder loading.",
        },
    )


def parse_dwd_temperature_zip(content: bytes, *, source_url: str) -> HourlySeries:
    rows: list[tuple[datetime, float]] = []
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        candidates = [name for name in archive.namelist() if "produkt_tu_stunde" in name.lower()]
        if len(candidates) != 1:
            raise ValueError("DWD archive must contain exactly one hourly temperature product.")
        text = archive.read(candidates[0]).decode("latin-1")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    for raw in reader:
        cleaned = {key.strip(): value.strip() for key, value in raw.items() if key}
        value = float(cleaned["TT_TU"])
        if value <= -999:
            continue
        observed = datetime.strptime(cleaned["MESS_DATUM"], "%Y%m%d%H").replace(tzinfo=timezone.utc)
        rows.append((observed, value))
    if not rows:
        raise ValueError("DWD archive contains no valid temperature observations.")
    return HourlySeries(
        "dwd-cdc-hourly-temperature",
        "air_temperature_2m",
        "degree_Celsius",
        tuple(rows),
        {
            "publisher": "Deutscher Wetterdienst Climate Data Center (DWD CDC)",
            "source_url": source_url,
            "licence": "DWD open-data terms",
            "artifact_sha256": _sha256(content),
            "evidence_boundary": "Weather observation; not network loading or capacity.",
        },
    )


def fetch_dwd_temperature(filename: str) -> HourlySeries:
    if "/" in filename or "\\" in filename or not filename.endswith(".zip"):
        raise ValueError("DWD filename must be a single ZIP filename.")
    url = DWD_TEMPERATURE_URL + filename
    with urllib.request.urlopen(url, timeout=120) as response:
        return parse_dwd_temperature_zip(response.read(), source_url=url)


def aggregate_mastr_ndjson(path: Path) -> dict[str, Any]:
    """Aggregate an accepted MaStR NDJSON release without treating MW as headroom."""
    technologies: dict[str, dict[str, float]] = {}
    source_sha256 = hashlib.sha256()
    count = 0
    status_counts: dict[str, int] = {}
    located_count = 0
    with path.open("rb") as stream:
        for raw_line in stream:
            source_sha256.update(raw_line)
            record = json.loads(raw_line)
            if record.get("record_type") != "asset":
                continue
            count += 1
            status = str(record.get("status") or "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
            if record.get("longitude") is not None and record.get("latitude") is not None:
                located_count += 1
            technology = str(record.get("technology") or record.get("asset_type") or "unknown")
            bucket = technologies.setdefault(technology, {"assets": 0, "net_capacity_mw": 0.0})
            bucket["assets"] += 1
            bucket["net_capacity_mw"] += float(record.get("net_capacity_mw") or 0)
    return {
        "source_key": "bnetza-mastr-asset-context",
        "publisher": "Bundesnetzagentur Marktstammdatenregister (MaStR)",
        "source_url": MASTR_SOURCE_URL,
        "licence": "MaStR public-data terms",
        "artifact_sha256": source_sha256.hexdigest(),
        "asset_count": count,
        "located_asset_count": located_count,
        "unlocated_asset_count": count - located_count,
        "status_counts": status_counts,
        "technology_aggregates": technologies,
        "evidence_boundary": "Registered asset context; not dispatch, loading or available capacity.",
    }


def align_complete_years(*series: HourlySeries) -> dict[int, list[tuple[datetime, ...]]]:
    """Return only UTC hours present in every supplied series, grouped by year."""
    if not series:
        return {}
    indexes = [{timestamp: value for timestamp, value in item.values} for item in series]
    common = set(indexes[0])
    for index in indexes[1:]:
        common &= set(index)
    result: dict[int, list[tuple[datetime, ...]]] = {}
    for timestamp in sorted(common):
        result.setdefault(timestamp.year, []).append(
            (timestamp, *(index[timestamp] for index in indexes))
        )
    return result


def series_manifest(series: Iterable[HourlySeries]) -> list[dict[str, Any]]:
    return [
        {
            "source_key": item.source_key,
            "metric": item.metric,
            "unit": item.unit,
            "observation_count": len(item.values),
            "from": item.values[0][0].isoformat() if item.values else None,
            "to": item.values[-1][0].isoformat() if item.values else None,
            "provenance": item.provenance,
        }
        for item in series
    ]
