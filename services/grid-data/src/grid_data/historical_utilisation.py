"""Offline, source-qualified generation statistics. Never connection headroom.

Run: python -m grid_data.historical_utilisation input.json output.json
No network requests, database writes, capacity inference or public publication.
"""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


def _instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset().total_seconds() != 0:
        raise ValueError("Use explicit UTC timestamps with zero offset")
    return parsed


def _number(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Numeric fields must be finite numbers")
    return float(value)


def calculate_historical_utilisation(payload: dict) -> dict:
    if payload.get("schema_version") != "gridpulse-generation-observations-v1":
        raise ValueError("Unsupported observation schema")
    source = payload["source"]
    if source.get("reuse_basis") not in {"licensed_derived_analysis", "private_authorised_analysis"}:
        raise ValueError("An explicit derived-analysis reuse basis is required")
    url = urlparse(source["url"])
    if url.scheme != "https" or not url.netloc or url.username or url.password:
        raise ValueError("An HTTPS source without credentials is required")
    _instant(source["published_at"])
    if not source.get("version") or not source.get("sha256") or len(source["sha256"]) != 64 or any(c not in "0123456789abcdef" for c in source["sha256"]):
        raise ValueError("Source version and SHA-256 are required")
    if payload.get("technology") not in {"wind", "solar", "hydro", "nuclear", "gas", "coal", "biomass", "geothermal"}:
        raise ValueError("A single supported generating technology is required; storage needs a separate metric")
    if payload.get("capacity_basis") != "net_ac_mw" or payload.get("generation_basis") != "net_mwh":
        raise ValueError("Use matched net AC capacity and net generation")
    start, end = _instant(payload["window_start"]), _instant(payload["window_end"])
    if end <= start or not payload.get("unit_id"):
        raise ValueError("A valid reporting window and unit identity are required")
    raw_intervals = payload["intervals"]
    if not isinstance(raw_intervals, list) or not raw_intervals or len(raw_intervals) > 100_000:
        raise ValueError("Supply between 1 and 100000 bounded observations")
    intervals = sorted(raw_intervals, key=lambda row: _instant(row["start"]))
    cursor, covered_hours, capacity_hours, energy = start, 0.0, 0.0, 0.0
    anomalous_interval = False
    for row in intervals:
        left, right = _instant(row["start"]), _instant(row["end"])
        if left < cursor or left < start or right > end or right <= left:
            raise ValueError("Intervals must not overlap or fall outside the reporting window")
        cursor = right
        capacity = _number(row["capacity_mw"])
        if capacity < 0:
            raise ValueError("Capacity cannot be negative")
        value = row.get("net_generation_mwh")
        if value is None:
            continue
        value = _number(value)
        if capacity == 0 and value != 0:
            raise ValueError("Generation without operating capacity requires reconciliation")
        hours = (right - left).total_seconds() / 3600
        if value < 0 or value > capacity * hours:
            anomalous_interval = True
        covered_hours += hours
        capacity_hours += capacity * hours
        energy += value
    total_hours = (end - start).total_seconds() / 3600
    coverage = covered_hours / total_hours
    observed_factor = energy / capacity_hours if capacity_hours else None
    flags = []
    if coverage < 1 - 1e-9:
        flags.append("incomplete_generation_coverage")
    if observed_factor is None:
        flags.append("no_operating_capacity")
    elif anomalous_interval or not 0 <= observed_factor <= 1:
        flags.append("net_output_or_capacity_requires_review")
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return {
        "schema_version": "gridpulse-historical-generation-utilisation-v1",
        "method_version": "capacity-hour-weighted-v1",
        "unit_id": payload["unit_id"], "technology": payload["technology"],
        "window_start": payload["window_start"], "window_end": payload["window_end"],
        "source": source, "input_sha256": hashlib.sha256(canonical.encode()).hexdigest(),
        "coverage_fraction": coverage, "net_generation_mwh": energy,
        "observed_capacity_hours_mwh": capacity_hours,
        "observed_capacity_factor": observed_factor,
        "capacity_factor": observed_factor if not flags else None,
        "quality_flags": flags, "capacity_claim": False, "connection_headroom_mw": None,
        "interpretation": "Historical generating output only; not runtime, efficiency, spare grid capacity or connection rights.",
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Input and output must differ")
    if args.input.stat().st_size > 32_000_000:
        parser.error("Input exceeds the 32 MB offline limit")
    result = calculate_historical_utilisation(json.loads(args.input.read_text(encoding="utf-8")))
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, indent=2, allow_nan=False)
