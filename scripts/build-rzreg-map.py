"""Build the public mixed-precision RZReg map artifact.

Validated facility addresses are geocoded once and cached. All other records use
the published RZReg postcode and a GeoNames postcode centroid. The output never
promotes a postcode centroid to a facility coordinate.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CLOUD = Path.home() / "OneDrive" / "GridPulse-Data" / "rzreg"
INPUT = Path(os.environ.get("RZREG_RECONCILIATION_CSV", DEFAULT_CLOUD / "government-location-research" / "2026-08-17" / "reconciliation" / "rzreg-public-evidence-reconciliation.csv"))
POSTCODES = Path(os.environ.get("RZREG_GEONAMES_POSTCODES", DEFAULT_CLOUD / "map-release" / "2026-08-17" / "geonames-DE" / "DE.txt"))
CACHE = Path(os.environ.get("RZREG_GEOCODE_CACHE", DEFAULT_CLOUD / "map-release" / "2026-08-17" / "address-geocode-cache.json"))
OUTPUT = ROOT / "public" / "power-finder" / "rzreg-data-centres.json"
EXACT = {"government_reported_site_address", "operator_reported_address"}
COORDINATE_OVERRIDES = {
    # Official NorthC address plus the explicitly named OSM telecom=data_center feature.
    "186": {"longitude": 11.602177, "latitude": 48.1191512, "osm_type": "node", "osm_id": 13574491231},
}


def postcode_centroids(path: Path) -> dict[str, tuple[float, float]]:
    points: dict[str, list[tuple[float, float]]] = defaultdict(list)
    with path.open(encoding="utf-8") as handle:
        for row in csv.reader(handle, delimiter="\t"):
            if len(row) >= 11 and row[1] and row[9] and row[10]:
                points[row[1]].append((float(row[10]), float(row[9])))
    return {
        code: (sum(x for x, _ in values) / len(values), sum(y for _, y in values) / len(values))
        for code, values in points.items()
    }


def geocode(address: str, cache: dict[str, dict[str, object]]) -> dict[str, object] | None:
    if address in cache:
        return cache[address]
    query = urllib.parse.urlencode({"q": f"{address}, Deutschland", "format": "jsonv2", "limit": 1, "countrycodes": "de"})
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={
            "User-Agent": (
                "GridPulse-RZReg-release-builder/1.0 "
                "(+https://github.com/SinaDevCool/gridpulse)"
            )
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        matches = json.load(response)
    result = None if not matches else {
        "longitude": float(matches[0]["lon"]),
        "latitude": float(matches[0]["lat"]),
        "display_name": matches[0].get("display_name"),
        "osm_type": matches[0].get("osm_type"),
        "osm_id": matches[0].get("osm_id"),
    }
    cache[address] = result
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    time.sleep(1.1)
    return result


def main() -> None:
    if not INPUT.exists() or not POSTCODES.exists():
        raise SystemExit("RZReg reconciliation or GeoNames postcode input is missing")
    with INPUT.open(encoding="utf-8-sig", newline="") as handle:
        records = list(csv.DictReader(handle))
    postcodes = postcode_centroids(POSTCODES)
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    features = []
    counts = defaultdict(int)
    for record in records:
        truth = record["final_truth_label"]
        exact = truth in EXACT and bool(record["final_address"])
        location = COORDINATE_OVERRIDES.get(record["rzreg_row"])
        if exact and not location:
            location = geocode(record["final_address"], cache)
        method = "validated_osm_feature" if record["rzreg_row"] in COORDINATE_OVERRIDES else ("validated_address_geocode" if location else "postcode_centroid")
        if not location:
            coordinate = postcodes.get(record["rzreg_postcode"])
            if not coordinate:
                postcode_location = geocode(f"PLZ {record['rzreg_postcode']}", cache)
                if postcode_location:
                    coordinate = (postcode_location["longitude"], postcode_location["latitude"])
                    method = "postcode_geocode"
                else:
                    prefix = record["rzreg_postcode"][:3]
                    nearby = [value for code, value in postcodes.items() if code.startswith(prefix)]
                    if not nearby:
                        raise SystemExit(f"No postcode-region coordinate for row {record['rzreg_row']}: {record['rzreg_postcode']}")
                    coordinate = (
                        sum(x for x, _ in nearby) / len(nearby),
                        sum(y for _, y in nearby) / len(nearby),
                    )
                    method = "postcode_prefix_centroid"
            longitude, latitude = coordinate
        else:
            longitude, latitude = location["longitude"], location["latitude"]
        precision = "facility_address" if location else "postcode_area"
        counts[precision] += 1
        features.append({
            "type": "Feature",
            "id": f"rzreg-{record['rzreg_row']}",
            "geometry": {"type": "Point", "coordinates": [round(longitude, 7), round(latitude, 7)]},
            "properties": {
                "id": f"rzreg-{record['rzreg_row']}",
                "rzreg_row": int(record["rzreg_row"]),
                "name": record["rzreg_name"],
                "operator": record["rzreg_operator"],
                "postcode": record["rzreg_postcode"],
                "address": record["final_address"] if location else None,
                "location_precision": precision,
                "coordinate_method": method,
                "truth_label": truth,
                "source_url": record["operator_source_url"] or record["source_url"] or None,
                "warning": None if location else (
                    "Approximate three-digit postcode region; the published postcode was not present in the admitted postcode dataset."
                    if method == "postcode_prefix_centroid"
                    else "Approximate postcode location; not the data-centre building."
                ),
            },
        })
    source_hash = hashlib.sha256(INPUT.read_bytes()).hexdigest()
    artifact = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "German RZReg data-centre locations",
            "publisher": "Grid Pulse reconciliation of RZReg and admitted public evidence",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "record_count": len(features),
            "facility_address_count": counts["facility_address"],
            "postcode_area_count": counts["postcode_area"],
            "source_sha256": source_hash,
            "attribution": "RZReg/BMWE; exact-address evidence as cited per record; postcode coordinates (c) GeoNames, CC BY 4.0; address geocoding (c) OpenStreetMap contributors.",
            "warning": "Locations do not establish grid capacity, headroom, connection feasibility, or operator confirmation.",
        },
        "features": features,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(artifact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(artifact["metadata"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
