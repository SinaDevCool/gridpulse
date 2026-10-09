"""Build the reproducible Release C2 German hourly benchmark artifact."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .benchmark_model import import_simbench_model
from .c2_hourly import build_operating_cases, calculate_hourly_envelopes
from .c2_sources import fetch_dwd_temperature, fetch_smard_hourly, series_manifest
from .network_study import PandapowerProvider
from .source_quality import accepted_release_manifest, assess_hourly_series

DWD_BERLIN_TEMPELHOF_2025 = "stundenwerte_TU_00433_19510101_20251231_hist.zip"


def _complete_year(
    observations: dict[datetime, float], year: int, *, maximum_missing_fraction: float = 0.005
) -> tuple[list[float], int]:
    expected = 8784 if year % 4 == 0 else 8760
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    timeline = [start + timedelta(hours=offset) for offset in range(expected)]
    missing = [timestamp for timestamp in timeline if timestamp not in observations]
    if len(missing) / expected > maximum_missing_fraction:
        raise ValueError(
            f"{year} source gap exceeds the C2 quality threshold: {len(missing)} hours."
        )
    values: list[float] = []
    known = [
        (timestamp, observations[timestamp]) for timestamp in timeline if timestamp in observations
    ]
    if not known:
        raise ValueError(f"{year} has no observations.")
    for timestamp in timeline:
        if timestamp in observations:
            values.append(observations[timestamp])
            continue
        before = next((item for item in reversed(known) if item[0] < timestamp), None)
        after = next((item for item in known if item[0] > timestamp), None)
        if before and after and (after[0] - before[0]).total_seconds() <= 48 * 3600:
            fraction = (timestamp - before[0]) / (after[0] - before[0])
            values.append(before[1] + (after[1] - before[1]) * fraction)
        elif before and (timestamp - before[0]).total_seconds() <= 24 * 3600:
            values.append(before[1])
        elif after and (after[0] - timestamp).total_seconds() <= 24 * 3600:
            values.append(after[1])
        else:
            raise ValueError(
                f"{year} contains an unfillable source gap at {timestamp.isoformat()}."
            )
    return values, len(missing)


def build_c2_benchmark_artifact(
    output: Path,
    *,
    weather_years: tuple[int, ...] = (2023, 2024, 2025),
    target_year: int = 2028,
    requested_import_mw: float = 10.0,
    code: str = "1-MV-urban--0-sw",
) -> dict[str, Any]:
    model = import_simbench_model(code)
    if len(set(weather_years)) < 2:
        raise ValueError("C2 benchmark validation requires at least two weather years.")
    smard = fetch_smard_hourly(start_year=min(weather_years), end_year=max(weather_years))
    dwd = fetch_dwd_temperature(DWD_BERLIN_TEMPELHOF_2025)
    quality_start = datetime(min(weather_years), 1, 1, tzinfo=timezone.utc)
    quality_end = datetime(max(weather_years) + 1, 1, 1, tzinfo=timezone.utc)
    quality_reports = [
        assess_hourly_series(
            smard,
            start=quality_start,
            end_exclusive=quality_end,
            parser_version="smard-hourly-v1",
        ),
        assess_hourly_series(
            dwd,
            start=quality_start,
            end_exclusive=quality_end,
            parser_version="dwd-cdc-temperature-v1",
        ),
    ]
    public_context_release = accepted_release_manifest(quality_reports)
    # SimBench provides representative renewable profiles. Temperature and
    # demand are observed German 2025 data; renewable scaling remains benchmark.
    import simbench  # type: ignore[import-not-found]

    net = simbench.get_simbench_net(code)
    renewable_table = net.profiles["renewables"].drop(columns=["time"], errors="ignore")
    renewable_quarter_hour = renewable_table.mean(axis=1).tolist()
    renewables = [
        sum(renewable_quarter_hour[index : index + 4]) / 4
        for index in range(0, len(renewable_quarter_hour), 4)
    ]
    cases = []
    imputed_hours: dict[str, dict[str, int]] = {}
    for weather_year in sorted(set(weather_years)):
        demand_by_hour = {timestamp: value for timestamp, value in smard.year(weather_year).values}
        temperature_by_hour = {
            timestamp: value for timestamp, value in dwd.year(weather_year).values
        }
        expected = 8784 if weather_year % 4 == 0 else 8760
        demand, demand_imputed = _complete_year(demand_by_hour, weather_year)
        temperatures, temperature_imputed = _complete_year(temperature_by_hour, weather_year)
        imputed_hours[str(weather_year)] = {
            "smard_grid_load": demand_imputed,
            "dwd_temperature": temperature_imputed,
        }
        cases.extend(
            build_operating_cases(
                weather_year=weather_year,
                demand_values=demand,
                temperature_values=temperatures,
                renewable_values=renewables[:expected],
                target_year=target_year,
            )
        )
    envelope = calculate_hourly_envelopes(
        model,
        cases,
        requested_import_mw=requested_import_mw,
        provider=PandapowerProvider(
            maximum_capacity_mw=max(100, requested_import_mw * 2),
            capacity_tolerance_mw=0.25,
        ),
        factor_precision=1,
    )
    artifact = {
        "schema_version": "gridpulse-c2-benchmark-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "public_label": "German hourly benchmark ensemble — not location capacity",
        "validation_class": "synthetic_demonstration",
        "model": {
            "id": model.model_id,
            "version": model.model_version,
            "connection_bus": model.connection_bus,
            "provenance": model.provenance,
        },
        "sources": series_manifest([smard, dwd])
        + [
            {
                "source_key": "simbench-renewable-profile",
                "metric": "representative_renewable_profile",
                "unit": "per_unit",
                "observation_count": len(renewables),
                "provenance": model.provenance,
            }
        ],
        "public_context_release": public_context_release,
        "method": {
            "weather_years": sorted(set(weather_years)),
            "target_year": target_year,
            "annual_demand_growth_rate": 0.015,
            "case_count": len(cases),
            "case_schema": asdict(cases[0]),
            "data_quality": {
                "imputed_hours": imputed_hours,
                "method": "linear interpolation for internal gaps up to 48 hours; edge fill up to 24 hours",
                "maximum_missing_fraction": 0.005,
            },
        },
        "envelope": envelope,
        "evidence_boundary": (
            "SMARD and DWD provide system/weather context. SimBench supplies a representative "
            "network and renewable profile. Results do not describe any mapped German node."
        ),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2, default=str), encoding="utf-8")
    return artifact
