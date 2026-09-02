"""Warm Germany Power Finder vector tiles through the production edge cache."""

from __future__ import annotations

import argparse
import math
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

GERMANY_BOUNDS = (5.8, 47.2, 15.1, 55.2)


def tile_coordinates(lon: float, lat: float, zoom: int) -> tuple[int, int]:
    scale = 1 << zoom
    x = int((lon + 180.0) / 360.0 * scale)
    latitude = math.radians(max(-85.05112878, min(85.05112878, lat)))
    y = int((1.0 - math.asinh(math.tan(latitude)) / math.pi) / 2.0 * scale)
    return x, y


def germany_tiles(min_zoom: int, max_zoom: int):
    west, south, east, north = GERMANY_BOUNDS
    for zoom in range(min_zoom, max_zoom + 1):
        min_x, max_y = tile_coordinates(west, south, zoom)
        max_x, min_y = tile_coordinates(east, north, zoom)
        for x in range(min_x, max_x + 1):
            for y in range(min_y, max_y + 1):
                yield zoom, x, y


def warm(base_url: str, tile: tuple[int, int, int], timeout: float):
    zoom, x, y = tile
    url = f"{base_url.rstrip('/')}/api/power-finder/tile/{zoom}/{x}/{y}"
    started = time.perf_counter()
    request = urllib.request.Request(url, headers={"User-Agent": "GridPulse tile warmer/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        response.read()
        return tile, response.status, response.headers.get("X-GridPulse-Cache", "UNKNOWN"), time.perf_counter() - started


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://gridpulseinsights.com")
    parser.add_argument("--min-zoom", type=int, default=4)
    parser.add_argument("--max-zoom", type=int, default=7)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--timeout", type=float, default=45)
    args = parser.parse_args()
    tiles = list(germany_tiles(args.min_zoom, args.max_zoom))
    hits = misses = failures = 0
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(warm, args.base_url, tile, args.timeout) for tile in tiles]
        for future in as_completed(futures):
            try:
                tile, status, cache_state, elapsed = future.result()
                hits += cache_state == "HIT"
                misses += cache_state != "HIT"
                print(f"{tile[0]}/{tile[1]}/{tile[2]} {status} {cache_state} {elapsed:.2f}s")
            except Exception as error:  # report every failed tile and finish the batch
                failures += 1
                print(f"ERROR {error}")
    elapsed = time.perf_counter() - started
    print(f"Warmed {len(tiles) - failures}/{len(tiles)} tiles in {elapsed:.1f}s; hits={hits}, misses={misses}, failures={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
