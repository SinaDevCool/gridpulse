import io
import json
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from grid_data.c2_sources import (
    aggregate_mastr_ndjson,
    parse_dwd_temperature_zip,
    smard_source_key,
)


def test_smard_metrics_have_distinct_provenance_keys():
    assert smard_source_key("actual_grid_load") == "bnetza-smard-grid-load"
    assert smard_source_key("day_ahead_price") == "bnetza-smard-day-ahead-price"


def test_dwd_zip_parser_preserves_provenance_and_rejects_missing_values():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "produkt_tu_stunde_test.txt",
            "STATIONS_ID;MESS_DATUM;QN_9;TT_TU;RF_TU;eor\n"
            "00433;2025010100;3;2.5;80;eor\n"
            "00433;2025010101;3;-999;80;eor\n",
        )
    result = parse_dwd_temperature_zip(
        buffer.getvalue(), source_url="https://opendata.dwd.de/x.zip"
    )
    assert len(result.values) == 1
    assert result.values[0][1] == 2.5
    assert result.provenance["artifact_sha256"]


def test_mastr_aggregation_never_labels_registered_capacity_as_headroom():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "assets.ndjson"
        path.write_text(
            "\n".join(
                [
                    json.dumps({"record_type": "manifest"}),
                    json.dumps(
                        {
                            "record_type": "asset",
                            "technology": "solar",
                            "net_capacity_mw": 2.5,
                        }
                    ),
                ]
            ),
            encoding="utf-8",
        )
        result = aggregate_mastr_ndjson(path)
    assert result["asset_count"] == 1
    assert result["technology_aggregates"]["solar"]["net_capacity_mw"] == 2.5
    assert "not dispatch" in result["evidence_boundary"]


def test_quarter_hour_prices_preserve_negative_values_and_reject_gaps(monkeypatch):
    import pytest

    from grid_data.c2_sources import fetch_smard_quarter_hour_prices

    epoch = 1767225600000
    series = [[epoch, -10], [epoch + 900000, 25]]

    def response(url, timeout):
        payload = {"timestamps": [epoch]} if "index_" in url else {"series": series}
        assert "quarterhour" in url
        return io.BytesIO(json.dumps(payload).encode())

    monkeypatch.setattr("urllib.request.urlopen", response)
    result = fetch_smard_quarter_hour_prices(start_year=2026, end_year=2026)
    assert [v for _, v in result.values] == [-10, 25]
    assert result.provenance["resolution_minutes"] == 15
    assert result.unit == "EUR_per_MWh"
    series[1][0] += 900000
    with pytest.raises(ValueError, match="gaps"):
        fetch_smard_quarter_hour_prices(start_year=2026, end_year=2026)
