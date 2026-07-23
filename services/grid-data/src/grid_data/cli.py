from __future__ import annotations

import argparse
from pathlib import Path

from .fixture import build_fixture
from .osm import build_osm_artifact
from .sql_export import write_ingestion_sql


def _bbox(value: str) -> tuple[float, float, float, float]:
    numbers = tuple(float(part.strip()) for part in value.split(","))
    if len(numbers) != 4:
        raise argparse.ArgumentTypeError("bbox must be south,west,north,east")
    south, west, north, east = numbers
    if south >= north or west >= east:
        raise argparse.ArgumentTypeError("bbox bounds are not ordered")
    return south, west, north, east


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(prog="grid-data")
    subcommands = command.add_subparsers(dest="command", required=True)
    fixture = subcommands.add_parser("build-fixture")
    fixture.add_argument("--input", type=Path, required=True)
    fixture.add_argument("--output", type=Path, required=True)
    osm = subcommands.add_parser("fetch-osm")
    osm.add_argument("--bbox", type=_bbox, required=True)
    osm.add_argument("--output", type=Path, required=True)
    osm.add_argument("--raw-input", type=Path)
    osm.add_argument("--endpoint", default="https://overpass-api.de/api/interpreter")
    sql = subcommands.add_parser("write-sql")
    sql.add_argument("--input", type=Path, required=True)
    sql.add_argument("--output", type=Path, required=True)
    return command


def main() -> None:
    args = parser().parse_args()
    if args.command == "build-fixture":
        report = build_fixture(args.input, args.output)
        print(f"Published {report.feature_count} validated fixture features ({report.sha256[:12]}).")
    elif args.command == "fetch-osm":
        report = build_osm_artifact(
            args.output,
            bbox=args.bbox,
            raw_path=args.raw_input,
            endpoint=args.endpoint,
        )
        print(
            f"Published {report.feature_count} OSM features "
            f"({report.output_sha256[:12]}); {len(report.warnings)} warnings."
        )
    elif args.command == "write-sql":
        count = write_ingestion_sql(args.input, args.output)
        print(f"Wrote a transactional ingestion script for {count} features.")


if __name__ == "__main__":
    main()
