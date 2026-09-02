from __future__ import annotations

import argparse
from pathlib import Path

from .benchmark_a import build_benchmark_a_artifact
from .benchmark_b import build_benchmark_b_artifact
from .benchmark_c import build_benchmark_c_artifact
from .benchmark_d import build_benchmark_d_artifact
from .benchmark_e import build_benchmark_e_artifact
from .benchmark_model import build_c1_validation_artifact
from .berlin_synthetic_capacity import build_berlin_synthetic_capacity_artifact
from .fifty_hertz_synthetic_capacity import build_fifty_hertz_synthetic_capacity_artifact
from .fifty_hertz_regional_screening import build_regional_screening_artifact
from .fifty_hertz_preapplication import build_preapplication_package
from .c1_publish import publish_c1_artifact
from .c2_benchmark import build_c2_benchmark_artifact
from .c2_publish import publish_c2_artifact
from .cgmes_import import import_cgmes_model
from .download import download_artifact
from .enrichment_sources import normalize_enrichment_geojson, publish_enrichment_release
from .fixture import build_fixture
from .geofabrik import discover_germany_pbf, discover_state_manifest
from .health import check_source, discover_mastr_export
from .mastr import parse_mastr_export, stream_mastr_export
from .national_pipeline import recommended_parse_workers, run_national_pipeline
from .national_release import combine_state_releases, parse_pbf_to_ndjson, write_copy_files
from .network_state import NetworkStateBuilder
from .network_study import PandapowerProvider
from .operator_evidence import fetch_operator_sources
from .operator_health_publish import publish_operator_health
from .operator_import import validate_operator_import_file
from .operator_matching import write_match_proposals
from .osm import build_osm_artifact
from .p0_foundation import ScenarioDefinition
from .pilot_acceptance import run_synthetic_pilot_acceptance
from .pilot_providers import OperatorPilotDataProvider, SyntheticPilotDataProvider
from .publish import publish_mastr_ndjson
from .publish_osm import publish_osm_national
from .reference_capacity_map import build_reference_capacity_map_artifact
from .release2_benchmark import build_release2_benchmark
from .release3_benchmark import build_release3_benchmark
from .release_audit import audit_release
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
    mastr_stream.add_argument("--exact-map-points-only", action="store_true")
    publish_mastr = subcommands.add_parser("publish-mastr")
    publish_mastr.add_argument("--input", type=Path, required=True)
    publish_mastr.add_argument("--batch-size", type=int, default=500)
    source_health = subcommands.add_parser("check-source")
    source_health.add_argument("--url", required=True)
    source_health.add_argument("--output", type=Path, required=True)
    mastr_health = subcommands.add_parser("check-mastr")
    mastr_health.add_argument("--output", type=Path, required=True)
    geofabrik_health = subcommands.add_parser("check-geofabrik")
    geofabrik_health.add_argument("--output", type=Path, required=True)
    geofabrik_states = subcommands.add_parser("discover-geofabrik-states")
    geofabrik_states.add_argument("--output", type=Path, required=True)
    parse_pbf = subcommands.add_parser("parse-osm-pbf")
    parse_pbf.add_argument("--input", type=Path, required=True)
    parse_pbf.add_argument("--output", type=Path, required=True)
    parse_pbf.add_argument("--expected-md5", required=True)
    parse_pbf.add_argument("--geographic-scope", required=True)
    aggregate_pbf = subcommands.add_parser("aggregate-osm-states")
    aggregate_pbf.add_argument("--input", type=Path, action="append", required=True)
    aggregate_pbf.add_argument("--output", type=Path, required=True)
    copy_pbf = subcommands.add_parser("write-osm-copy")
    copy_pbf.add_argument("--input", type=Path, required=True)
    copy_pbf.add_argument("--output-dir", type=Path, required=True)
    national = subcommands.add_parser("run-national-osm")
    national.add_argument("--work-dir", type=Path, required=True)
    national.add_argument("--download-workers", type=int, default=6)
    national.add_argument("--parse-workers", type=int, default=recommended_parse_workers())
    publish_national = subcommands.add_parser("publish-national-osm")
    publish_national.add_argument("--input", type=Path, required=True)
    publish_national.add_argument("--manifest", type=Path, required=True)
    publish_national.add_argument("--batch-size", type=int, default=250)
    enrichment = subcommands.add_parser("normalize-enrichment-source")
    enrichment.add_argument("--source", required=True, choices=["bkg_admin", "osm_context", "bfn_protected", "bkg_heavy_rain"])
    enrichment.add_argument("--input", type=Path, required=True)
    enrichment.add_argument("--output", type=Path, required=True)
    publish_enrichment = subcommands.add_parser("publish-enrichment-source")
    publish_enrichment.add_argument("--source", required=True, choices=["bkg_admin", "osm_context", "bfn_protected", "bkg_heavy_rain"])
    publish_enrichment.add_argument("--input", type=Path, required=True)
    publish_enrichment.add_argument("--manifest", type=Path, required=True)
    publish_enrichment.add_argument("--batch-size", type=int, default=250)
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
    release_audit = subcommands.add_parser("audit-release")
    release_audit.add_argument("--input", type=Path, required=True)
    release_audit.add_argument("--output", type=Path, required=True)
    c1 = subcommands.add_parser("validate-c1-benchmark")
    c1.add_argument("--code", default="1-MV-urban--0-sw")
    c1.add_argument("--output", type=Path, required=True)
    benchmark_a = subcommands.add_parser("validate-benchmark-a")
    benchmark_a.add_argument("--code", action="append")
    benchmark_a.add_argument("--contingency-limit", type=int, default=2)
    benchmark_a.add_argument("--tolerance-mw", type=float, default=0.1)
    benchmark_a.add_argument("--maximum-capacity-mw", type=float, default=25.0)
    benchmark_a.add_argument("--output", type=Path, required=True)
    benchmark_b = subcommands.add_parser("validate-benchmark-b")
    benchmark_b.add_argument("--code", action="append")
    benchmark_b.add_argument("--contingency-limit", type=int, default=2)
    benchmark_b.add_argument("--tolerance-mw", type=float, default=0.1)
    benchmark_b.add_argument("--voltage-tolerance-pu", type=float, default=1e-4)
    benchmark_b.add_argument("--loading-tolerance-percent", type=float, default=0.1)
    benchmark_b.add_argument("--maximum-capacity-mw", type=float, default=25.0)
    benchmark_b.add_argument("--output", type=Path, required=True)
    benchmark_c = subcommands.add_parser("validate-benchmark-c")
    benchmark_c.add_argument("--observed", type=Path)
    benchmark_c.add_argument("--simulated", type=Path)
    benchmark_c.add_argument("--evidence", type=Path)
    benchmark_c.add_argument("--trusted-public-key", type=Path)
    benchmark_c.add_argument("--minimum-observations", type=int, default=4)
    benchmark_c.add_argument("--minimum-coverage", type=float, default=0.95)
    benchmark_c.add_argument("--output", type=Path, required=True)
    benchmark_d = subcommands.add_parser("validate-benchmark-d")
    benchmark_d.add_argument("--predictions", type=Path)
    benchmark_d.add_argument("--references", type=Path)
    benchmark_d.add_argument("--evidence", type=Path)
    benchmark_d.add_argument("--trusted-public-key", type=Path)
    benchmark_d.add_argument("--minimum-cases", type=int, default=4)
    benchmark_d.add_argument("--minimum-coverage", type=float, default=0.95)
    benchmark_d.add_argument("--output", type=Path, required=True)
    benchmark_e = subcommands.add_parser("validate-benchmark-e")
    benchmark_e.add_argument("--predictions", type=Path)
    benchmark_e.add_argument("--outcomes", type=Path)
    benchmark_e.add_argument("--evidence", type=Path)
    benchmark_e.add_argument("--trusted-public-key", type=Path)
    benchmark_e.add_argument("--minimum-cases", type=int, default=20)
    benchmark_e.add_argument("--minimum-sites", type=int, default=4)
    benchmark_e.add_argument("--minimum-strata", type=int, default=4)
    benchmark_e.add_argument("--output", type=Path, required=True)
    reference_capacity = subcommands.add_parser("validate-reference-capacity-map")
    reference_capacity.add_argument("--code", default="1-MV-urban--0-sw")
    reference_capacity.add_argument("--limit", type=int, default=12)
    reference_capacity.add_argument("--output", type=Path, required=True)
    berlin_capacity = subcommands.add_parser("build-berlin-synthetic-capacity")
    berlin_capacity.add_argument("--output", type=Path, required=True)
    fifty_hertz_capacity = subcommands.add_parser("build-50hertz-synthetic-capacity")
    fifty_hertz_capacity.add_argument("--output", type=Path, required=True)
    fifty_hertz_regional = subcommands.add_parser("build-50hertz-regional-screening")
    fifty_hertz_regional.add_argument("--source", type=Path, required=True)
    fifty_hertz_regional.add_argument("--output", type=Path, required=True)
    fifty_hertz_regional.add_argument("--limit", type=int, default=30)
    fifty_hertz_package = subcommands.add_parser("build-50hertz-preapplication")
    fifty_hertz_package.add_argument("--regional", type=Path, required=True)
    fifty_hertz_package.add_argument("--output", type=Path, required=True)
    fifty_hertz_package.add_argument("--request", type=Path, required=True)
    fifty_hertz_package.add_argument("--requested-mw", type=float, default=500.0)
    fifty_hertz_package.add_argument("--target-year", type=int, default=2030)
    publish_c1 = subcommands.add_parser("publish-c1-benchmark")
    publish_c1.add_argument("--input", type=Path, required=True)
    cgmes = subcommands.add_parser("import-cgmes")
    cgmes.add_argument("--input", type=Path, action="append", required=True)
    cgmes.add_argument("--output-model", type=Path, required=True)
    cgmes.add_argument("--output-manifest", type=Path, required=True)
    cgmes.add_argument("--model-key", required=True)
    cgmes.add_argument("--model-version", required=True)
    cgmes.add_argument("--source-url", required=True)
    cgmes.add_argument("--licence", required=True)
    cgmes.add_argument("--cgmes-version", choices=["2.4.15", "3.0"], default="3.0")
    c2 = subcommands.add_parser("validate-c2-benchmark")
    c2.add_argument("--output", type=Path, required=True)
    c2.add_argument("--weather-year", type=int, action="append")
    c2.add_argument("--target-year", type=int, default=2028)
    c2.add_argument("--requested-import-mw", type=float, default=10.0)
    c2.add_argument("--code", default="1-MV-urban--0-sw")
    publish_c2 = subcommands.add_parser("publish-c2-benchmark")
    publish_c2.add_argument("--input", type=Path, required=True)
    pilot = subcommands.add_parser("validate-pilot-package")
    pilot.add_argument("--input", type=Path, required=True)
    pilot.add_argument("--kind", choices=["synthetic", "operator"], required=True)
    release1 = subcommands.add_parser("validate-release1")
    release1.add_argument("--input", type=Path, required=True)
    release2 = subcommands.add_parser("validate-release2")
    release2.add_argument("--input", type=Path, required=True)
    release2.add_argument("--output", type=Path, required=True)
    release2.add_argument("--model-artifact", type=Path, required=True)
    release2.add_argument("--public-output", type=Path)
    release3 = subcommands.add_parser("validate-release3")
    release3.add_argument("--input", type=Path, required=True)
    release3.add_argument("--output", type=Path, required=True)
    release3.add_argument("--public-output", type=Path)
    acceptance = subcommands.add_parser("validate-synthetic-pilot")
    acceptance.add_argument("--input", type=Path, required=True)
    acceptance.add_argument("--output", type=Path, required=True)
    acceptance.add_argument("--public-output", type=Path)
    return command


def main() -> None:
    args = parser().parse_args()
    if args.command == "build-fixture":
        report = build_fixture(args.input, args.output)
        print(
            f"Published {report.feature_count} validated fixture features ({report.sha256[:12]})."
        )
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
    elif args.command == "normalize-enrichment-source":
        report = normalize_enrichment_geojson(args.source, args.input, args.output)
        print(f"Validated {report.records} {report.source} records; {report.rejected} rejected.")
    elif args.command == "publish-enrichment-source":
        report = publish_enrichment_release(args.source, args.input, args.manifest, batch_size=args.batch_size)
        print(f"Activated {report['source']} release {report['release_id']} with {report['records']} records.")
    elif args.command == "download":
        report = download_artifact(args.url, args.output)
        print(
            f"Downloaded {report.bytes_downloaded} bytes to {report.path}; sha256={report.sha256}."
        )
    elif args.command == "stream-mastr":
        report = stream_mastr_export(
            args.input,
            args.output,
            federal_state=args.federal_state,
            exact_map_points_only=args.exact_map_points_only,
        )
        print(
            f"Streamed {report.asset_count} MaStR assets; "
            f"{report.skipped_count} lack exact coordinates."
        )
    elif args.command == "publish-mastr":
        report = publish_mastr_ndjson(args.input, batch_size=args.batch_size)
        print(f"Activated release {report.release_id} with {report.records_published} assets.")
    elif args.command == "check-source":
        report = check_source(args.url, args.output)
        print(f"Source returned HTTP {report['status']} with {report['content_length']} bytes.")
    elif args.command == "check-mastr":
        report = discover_mastr_export(args.output)
        print(f"Current MaStR export is {report['url']} ({report['content_length']} bytes).")
    elif args.command == "check-geofabrik":
        report = discover_germany_pbf(args.output)
        print(
            f"Current Germany PBF advertises {report['content_length']} bytes; "
            "manifest remains unaccepted until batch validation."
        )
    elif args.command == "discover-geofabrik-states":
        report = discover_state_manifest(args.output)
        print(f"Discovered {len(report['extracts'])} bounded extracts covering 16 states.")
    elif args.command == "parse-osm-pbf":
        report = parse_pbf_to_ndjson(
            args.input, args.output,
            expected_md5=args.expected_md5,
            geographic_scope=args.geographic_scope,
        )
        print(f"Staged {report.records_staged} OSM records; valid={report.valid}.")
        if not report.valid:
            raise SystemExit(1)
    elif args.command == "aggregate-osm-states":
        report = combine_state_releases(args.input, args.output)
        print(f"Validated national manifest with {report['record_count']} records.")
    elif args.command == "write-osm-copy":
        counts = write_copy_files(args.input, args.output_dir)
        print(f"Wrote COPY files: {counts}.")
    elif args.command == "run-national-osm":
        report = run_national_pipeline(
            args.work_dir,
            download_workers=args.download_workers,
            parse_workers=args.parse_workers,
        )
        print(f"Prepared {report.records} national OSM records; valid={report.valid}.")
        if not report.valid:
            raise SystemExit(1)
    elif args.command == "publish-national-osm":
        report = publish_osm_national(
            args.input, args.manifest, batch_size=args.batch_size
        )
        print(
            f"Activated national release {report.release_id} with "
            f"{report.records_published} records."
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
        print(f"Validated {report['record_count']} operator records; valid={report['valid']}.")
    elif args.command == "publish-operator-health":
        report = publish_operator_health(args.input)
        print(
            f"Published {report['published']} source checks; "
            f"{report['failed']} endpoint failures recorded."
        )
    elif args.command == "audit-release":
        report = audit_release(args.input, args.output)
        print(
            f"Audited {report['feature_count']} features; valid={report['valid']}; "
            f"sha256={report['sha256'][:12]}."
        )
        if not report["valid"]:
            raise SystemExit(1)
    elif args.command == "validate-c1-benchmark":
        report = build_c1_validation_artifact(args.output, args.code)
        capacity = next(item for item in report["results"] if item["study_type"] == "capacity")
        print(
            f"Validated {report['model_id']} with pandapower; "
            f"benchmark import boundary={capacity['values']['firm_import_capacity_mw']} MW."
        )
    elif args.command == "validate-reference-capacity-map":
        if args.limit < 1:
            raise SystemExit("Reference capacity result limit must be at least one.")
        report = build_reference_capacity_map_artifact(args.output, args.code, args.limit)
        print(
            f"Calculated {len(report['results'])} governed reference-network capacity results; "
            f"sha256={report['results_sha256'][:12]}."
        )
    elif args.command == "validate-benchmark-a":
        options = {"output": args.output}
        if args.code:
            options["codes"] = tuple(args.code)
        report = build_benchmark_a_artifact(
            **options,
            contingency_limit=args.contingency_limit,
            tolerance_mw=args.tolerance_mw,
            maximum_capacity_mw=args.maximum_capacity_mw,
        )
        print(
            f"Benchmark A: {report['summary']['passed_count']}/{report['summary']['case_count']} "
            f"cases passed; sha256={report['benchmark_sha256'][:12]}."
        )
        if not report["summary"]["all_passed"]:
            raise SystemExit(1)
    elif args.command == "validate-benchmark-b":
        options = {"output": args.output}
        if args.code:
            options["codes"] = tuple(args.code)
        report = build_benchmark_b_artifact(
            **options,
            contingency_limit=args.contingency_limit,
            tolerance_mw=args.tolerance_mw,
            voltage_tolerance_pu=args.voltage_tolerance_pu,
            loading_tolerance_percent=args.loading_tolerance_percent,
            maximum_capacity_mw=args.maximum_capacity_mw,
        )
        print(
            f"Benchmark B: {report['summary']['passed_count']}/{report['summary']['case_count']} "
            f"cases passed; sha256={report['benchmark_sha256'][:12]}."
        )
        if not report["summary"]["all_passed"]:
            raise SystemExit(1)
    elif args.command == "validate-benchmark-c":
        report = build_benchmark_c_artifact(
            args.output,
            observed_path=args.observed,
            simulated_path=args.simulated,
            evidence_path=args.evidence,
            trusted_public_key_path=args.trusted_public_key,
            minimum_observations=args.minimum_observations,
            minimum_coverage=args.minimum_coverage,
        )
        print(
            f"Benchmark C: numerical={'passed' if report['numerical_reconciliation_passed'] else 'failed'}; "
            f"operator-validation={'passed' if report['operator_validation_passed'] else 'not-passed'}; "
            f"sha256={report['benchmark_sha256'][:12]}."
        )
        if not report["benchmark_execution_passed"]:
            raise SystemExit(1)
    elif args.command == "validate-benchmark-d":
        report = build_benchmark_d_artifact(
            args.output,
            predictions_path=args.predictions,
            references_path=args.references,
            evidence_path=args.evidence,
            trusted_public_key_path=args.trusted_public_key,
            minimum_cases=args.minimum_cases,
            minimum_coverage=args.minimum_coverage,
        )
        print(
            f"Benchmark D: numerical={'passed' if report['numerical_outcome_backtest_passed'] else 'failed'}; "
            f"operator-outcomes={'passed' if report['operator_outcome_validation_passed'] else 'not-passed'}; "
            f"sha256={report['benchmark_sha256'][:12]}."
        )
        if not report["benchmark_execution_passed"]:
            raise SystemExit(1)
    elif args.command == "validate-benchmark-e":
        report = build_benchmark_e_artifact(
            args.output,
            predictions_path=args.predictions,
            outcomes_path=args.outcomes,
            evidence_path=args.evidence,
            trusted_public_key_path=args.trusted_public_key,
            minimum_cases=args.minimum_cases,
            minimum_sites=args.minimum_sites,
            minimum_strata=args.minimum_strata,
        )
        print(
            f"Benchmark E: prospective={'passed' if report['prospective_numerical_validation_passed'] else 'failed'}; "
            f"operator-validation={'passed' if report['operator_prospective_validation_passed'] else 'not-passed'}; "
            f"sha256={report['benchmark_sha256'][:12]}."
        )
        if not report["benchmark_execution_passed"]:
            raise SystemExit(1)
    elif args.command == "build-berlin-synthetic-capacity":
        report = build_berlin_synthetic_capacity_artifact(args.output)
        print(
            f"Calculated {len(report['results'])} Berlin synthetic N-0/N-1 results; "
            f"sha256={report['results_sha256'][:12]}."
        )
    elif args.command == "build-50hertz-synthetic-capacity":
        report = build_fifty_hertz_synthetic_capacity_artifact(args.output)
        leader = report["results"][0]
        print(
            f"Calculated {len(report['results'])} 50Hertz-focused synthetic yard results; "
            f"screen-first={leader['location']} ({leader['n1_firm_proxy_mw']} MW proxy)."
        )
    elif args.command == "build-50hertz-regional-screening":
        report = build_regional_screening_artifact(args.source, args.output, limit=args.limit)
        leader = report["results"][0]
        print(
            f"Ranked {len(report['results'])} synthetic 50Hertz-area opportunities; "
            f"screen-first={leader['location']} (P10={leader['firm_proxy']['p10_mw']} MW)."
        )
    elif args.command == "build-50hertz-preapplication":
        report = build_preapplication_package(
            args.regional, args.output, args.request,
            requested_mw=args.requested_mw, target_year=args.target_year,
        )
        print(
            f"Prepared {report['summary']['site_count']} frozen site dossiers; "
            f"P10 passes={report['summary']['passes_p10_count']}; operator outcomes=0."
        )
    elif args.command == "publish-c1-benchmark":
        report = publish_c1_artifact(args.input)
        print(f"Published C1 model {report['model_version_id']} and {report['runs']} study runs.")
    elif args.command == "import-cgmes":
        report = import_cgmes_model(
            args.input,
            args.output_model,
            args.output_manifest,
            model_key=args.model_key,
            model_version=args.model_version,
            source_url=args.source_url,
            licence=args.licence,
            cgmes_version=args.cgmes_version,
        )
        print(
            f"Imported {report['model_key']} with {report['element_counts']['buses']} buses; "
            "validation class remains operator_model_unvalidated."
        )
    elif args.command == "validate-c2-benchmark":
        report = build_c2_benchmark_artifact(
            args.output,
            weather_years=tuple(args.weather_year or (2023, 2024, 2025)),
            target_year=args.target_year,
            requested_import_mw=args.requested_import_mw,
            code=args.code,
        )
        print(
            f"Validated {report['envelope']['hour_count']} C2 hourly cases; "
            f"P10/P50/P90={report['envelope']['p10_capacity_mw']}/"
            f"{report['envelope']['p50_capacity_mw']}/"
            f"{report['envelope']['p90_capacity_mw']} MW."
        )
    elif args.command == "publish-c2-benchmark":
        report = publish_c2_artifact(args.input)
        print(f"Published C2 ensemble {report['ensemble_id']}.")
    elif args.command == "validate-pilot-package":
        provider = (
            SyntheticPilotDataProvider(args.input)
            if args.kind == "synthetic"
            else OperatorPilotDataProvider(args.input)
        )
        bundle = provider.load()
        print(
            f"Validated {bundle.manifest.dataset_id}@{bundle.manifest.dataset_version}; "
            f"observations={len(bundle.observations)}; sha256={bundle.dataset_hash}."
        )
    elif args.command == "validate-release1":
        bundle = SyntheticPilotDataProvider(args.input).load()
        builder = NetworkStateBuilder(bundle)
        scenario = ScenarioDefinition(
            scenario_id="release1-acceptance",
            demand_factor=1.1,
            renewable_factor=0.6,
            queue_project_ids=("synthetic-queue-001",),
            reinforcement_ids=("synthetic-reinforcement-trafo-2",),
            battery_dispatch_mw=4,
            flexible_load_reduction_mw=2,
            weather_year=2025,
            hour_of_year=8759,
        )
        state = builder.build(scenario)
        result = PandapowerProvider().run_base_case(state)
        if not result.converged:
            raise SystemExit("Release 1 acceptance state did not converge.")
        print(
            f"Validated Release 1 state {scenario.input_hash[:12]}; "
            f"loads={len(state.loads)}; transformers={len(state.transformers)}; "
            f"validation={state.validation_class}."
        )
    elif args.command == "validate-release2":
        report = build_release2_benchmark(
            args.input, args.output, args.model_artifact, args.public_output
        )
        round_data = report["active_learning_round"]
        print(
            f"Validated Release 2; candidates={round_data['candidate_count']}; "
            f"physics_selected={round_data['selected_count']}; "
            f"physics_coverage={round_data['physics_coverage']:.0%}; "
            f"mandatory_coverage={round_data['mandatory_contingency_coverage']:.0%}; "
            f"promotion={report['promotion']['decision']}; "
            f"artifact={report['artifact']['artifact_sha256'][:12]}."
        )
    elif args.command == "validate-release3":
        report = build_release3_benchmark(args.input, args.output, args.public_output)
        metrics = report["shadow"]["metrics"]
        print(
            f"Validated Release 3 shadow run; verified={metrics['verified_count']}; "
            f"coverage={metrics['physics_coverage']}; "
            f"decision={report['champion_decision']['decision']}."
        )
    elif args.command == "validate-synthetic-pilot":
        bundle = SyntheticPilotDataProvider(args.input).load()
        report = run_synthetic_pilot_acceptance(bundle, args.output, args.public_output)
        if not report["all_repository_gates_passed"]:
            raise SystemExit("Synthetic pilot acceptance gates did not pass.")
        reduction = report["reduction_benchmark"]
        print(
            f"Validated all synthetic pilot phases; reduction={reduction['compute_reduction']}; "
            f"report={report['report_sha256'][:12]}."
        )


if __name__ == "__main__":
    main()
