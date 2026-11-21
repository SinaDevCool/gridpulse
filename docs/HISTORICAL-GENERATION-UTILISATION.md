# Historical generating-output qualification

This offline workflow belongs to the existing grid-data ingestion boundary. It does not
create a second optimiser, run in a web request, publish records, or infer connection MW.

Run with PYTHONPATH=services/grid-data/src:

    python -m grid_data.historical_utilisation observations.json report.json
    python -m unittest discover -s services/grid-data/tests -p test_historical_utilisation.py

The output path must not already exist. Input is bounded to 32 MB. A single generating unit,
technology, explicit UTC reporting window, net AC capacity and net output are required.
Each interval supplies start, end, capacity_mw and nullable net_generation_mwh. Capacity
factor is sum(net MWh) / sum(net AC MW * observed interval hours), with actual UTC durations.
Missing generation is never zero. Gaps, overlaps, mismatched DC/AC basis, missing reuse
qualification, storage assets and anomalous output prevent an unqualified result. A partial
period has an observed ratio but no full-window capacity_factor. Source version, original
artifact SHA-256 and input hash travel with the report.

Example input contract:

    {
      "schema_version": "gridpulse-generation-observations-v1",
      "unit_id": "reviewed-unit-identity",
      "technology": "wind",
      "capacity_basis": "net_ac_mw",
      "generation_basis": "net_mwh",
      "window_start": "2025-01-01T00:00:00Z",
      "window_end": "2026-01-01T00:00:00Z",
      "source": {
        "url": "https://official-source.example/data",
        "published_at": "2026-02-01T00:00:00Z",
        "version": "reviewed-source-release",
        "sha256": "<actual 64-character lowercase source SHA-256>",
        "reuse_basis": "private_authorised_analysis"
      },
      "intervals": [
        { "start": "2025-01-01T00:00:00Z", "end": "2026-01-01T00:00:00Z",
          "capacity_mw": 100, "net_generation_mwh": 262800 }
      ]
    }

The declared reuse basis is a required admission record, not a licence verification service.
A reviewer must establish it from source terms. Public derived publication requires the
licensed_derived_analysis basis and an independent publication review. No import or public
map layer is enabled automatically. A cohort-relative colour requires a versioned cohort,
technology/role matching, minimum sample rules, weather context and an independent backtest.

## Authoritative German references

- SMARD plant output: https://www.smard.de/home/downloadcenter/download-kraftwerksdaten/
- SMARD terms (including the separate wholesale-price review): https://www.smard.de/home/datennutzung
- MaStR excludes operational movement data: https://www.marktstammdatenregister.de/MaStRHilfe/subpages/glossar.html
- EIA capacity-factor definition: https://www.eia.gov/tools/glossary/index.php?id=Capacity_factor

Historical output, operating hours, efficiency, flexible-load availability and grid headroom
must remain separate fields. Retired sites require a separate review of connection rights,
physical condition, environmental liabilities, land and operator agreement.
