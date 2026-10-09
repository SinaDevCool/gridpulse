from datetime import datetime, timezone

from grid_data.public_context import build_manifest, parse_redispatch_csv


def test_redispatch_parser_normalizes_context_without_capacity_claim():
    content = (
        b"ID;Beginn;Ende;Netzbetreiber;Richtung;Arbeit_MWh;Grund;Gebiet\n"
        b"m-1;2026-01-01T10:00:00+01:00;2026-01-01T11:00:00+01:00;TSO;up;12,5;congestion;DE-BB\n"
    )
    rows = parse_redispatch_csv(content, source_url="https://www.netztransparenz.de/example.csv")
    assert len(rows) == 1
    assert rows[0].volume_mwh == 12.5
    assert rows[0].starts_at.endswith("+00:00")


def test_ingestion_manifest_is_content_addressed_and_idempotent():
    content = b"one,two\n"
    started = datetime(2026, 1, 1, tzinfo=timezone.utc)
    first = build_manifest("source", content, [1], started_at=started, completed_at=started)
    second = build_manifest("source", content, [1], started_at=started, completed_at=started)
    assert first.run_key == second.run_key
    assert first.artifact_sha256 == second.artifact_sha256
