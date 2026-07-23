from __future__ import annotations

import argparse
from pathlib import Path

from .download import download_artifact
from .fixture import build_fixture
from .health import check_source, discover_mastr_export
from .mastr import parse_mastr_export, stream_mastr_export
from .osm import build_osm_artifact
from .operator_evidence import fetch_operator_sources
from .operator_import import validate_operator_import_file
from .operator_health_publish import publish_operator_health
from .operator_matching import write_match_proposals
from .publish import publish_mastr_ndjson
from .sql_export import write_ingestion_sql, write_mastr_sql


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
    mastr = subcommands.add_parser("parse-mastr")
    mastr.add_argument("--input", type=Path, required=True)
    mastr.add_argument("--output", type=Path, required=True)
    mastr.add_argument("--federal-state")
    mastr_sql = subcommands.add_parser("write-mastr-sql")
    mastr_sql.add_argument("--input", type=Path, required=True)
    mastr_sql.add_argument("--output", type=Path, required=True)
    download = subcommands.add_parser("download")
    download.add_argument("--url", required=True)
    download.add_argument("--output", type=Path, required=True)
    mastr_stream = subcommands.add_parser("stream-mastr")
    mastr_stream.add_argument("--input", type=Path, required=True)
    mastr_stream.add_argument("--output", type=Path, required=True)
    mastr_stream.add_argument("--federal-state")
    publish_mastr = subcommands.add_parser("publish-mastr")
    publish_mastr.add_argument("--input", type=Path, required=True)
    publish_mastr.add_argument("--batch-size", type=int, default=500)
    source_health = subcommands.add_parser("check-source")
    source_health.add_argument("--url", required=True)
    source_health.add_argument("--output", type=Path, required=True)
    mastr_health = subcommands.add_parser("check-mastr")
    mastr_health.add_argument("--output", type=Path, required=True)
    operator_sources = subcommands.add_parser("fetch-operator-evidence")
    operator_sources.add_argument("--output", type=Path, required=True)
    operator_matches = subcommands.add_parser("propose-operator-matches")
    operator_matches.add_argument("--input", type=Path, required=True)
    operator_matches.add_argument("--output", type=Path, required=True)
    operator_import = subcommands.add_parser("validate-operator-import")
    operator_import.add_argument("--input", type=Path, required=True)
    operator_import.add_argument("--output", type=Path, required=True)
    publish_health = subcommands.add_parser("publish-operator-health")
    publish_health.add_argument("--input", type=Path, required=True)
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
    elif args.command == "parse-mastr":
        report = parse_mastr_export(
            args.input,
            args.output,
            federal_state=args.federal_state,
        )
        print(
            f"Published {report.asset_count} MaStR assets; "
            f"{report.skipped_count} lack exact coordinates and "
            f"{len(report.warnings)} warnings were recorded."
        )
    elif args.command == "write-mastr-sql":
        count = write_mastr_sql(args.input, args.output)
        print(f"Wrote a transactional MaStR ingestion script for {count} assets.")
    elif args.command == "download":
        report = download_artifact(args.url, args.output)
        print(
            f"Downloaded {report.bytes_downloaded} bytes to {report.path}; "
            f"sha256={report.sha256}."
        )
    elif args.command == "stream-mastr":
        report = stream_mastr_export(
            args.input,
            args.output,
            federal_state=args.federal_state,
        )
        print(
            f"Streamed {report.asset_count} MaStR assets; "
            f"{report.skipped_count} lack exact coordinates."
        )
    elif args.command == "publish-mastr":
        report = publish_mastr_ndjson(args.input, batch_size=args.batch_size)
        print(
            f"Activated release {report.release_id} with "
            f"{report.records_published} assets."
        )
    elif args.command == "check-source":
        report = check_source(args.url, args.output)
        print(
            f"Source returned HTTP {report['status']} with "
            f"{report['content_length']} bytes."
        )
    elif args.command == "check-mastr":
        report = discover_mastr_export(args.output)
        print(
            f"Current MaStR export is {report['url']} "
            f"({report['content_length']} bytes)."
        )
    elif args.command == "fetch-operator-evidence":
        report = fetch_operator_sources(args.output)
        print(
            f"Checked {report['record_count']}/{report['expected_count']} "
            f"official operator endpoints; valid={report['valid']}."
        )
    elif args.command == "propose-operator-matches":
        report = write_match_proposals(args.input, args.output)
        print(f"Wrote {report['proposal_count']} human-review match proposals.")
    elif args.command == "validate-operator-import":
        report = validate_operator_import_file(args.input, args.output)
        print(
            f"Validated {report['record_count']} operator records; valid={report['valid']}."
        )
    elif args.command == "publish-operator-health":
        report = publish_operator_health(args.input)
        print(
            f"Published {report['published']} source checks; "
            f"{report['failed']} endpoint failures recorded."
        )


if __name__ == "__main__":
    main()
