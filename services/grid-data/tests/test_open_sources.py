import pytest

from grid_data.open_sources import parse_entsoe_timeseries, parse_vnbdigital_operator_csv


def test_entsoe_parser_preserves_period_and_position() -> None:
    xml = b"""<Publication_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-6:publicationdocument:7:3">
      <TimeSeries><mRID>load-1</mRID><Period><timeInterval><start>2026-01-01T00:00Z</start></timeInterval>
      <resolution>PT60M</resolution><Point><position>1</position><quantity>42.5</quantity></Point></Period></TimeSeries>
    </Publication_MarketDocument>"""
    assert parse_entsoe_timeseries(xml) == [
        {
            "series_id": "load-1",
            "period_start": "2026-01-01T00:00Z",
            "resolution": "PT60M",
            "position": 1,
            "quantity": 42.5,
        }
    ]


def test_entsoe_parser_quarantines_empty_document() -> None:
    with pytest.raises(ValueError, match="no valid"):
        parse_entsoe_timeseries(b"<Publication_MarketDocument />")


def test_vnbdigital_crosswalk_never_claims_capacity() -> None:
    rows = parse_vnbdigital_operator_csv(
        b"operator_name;region_code;source_url\nE.DIS Netz GmbH;DE-BB;https://example.test/source\n"
    )
    assert rows[0]["operator_name"] == "E.DIS Netz GmbH"
    assert rows[0]["capacity_claim"] is False
