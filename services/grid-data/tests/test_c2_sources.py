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
