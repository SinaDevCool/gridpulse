"""Build the public RZReg performance artifact from the cloud-backed workbook.

The workbook remains outside Git. This script emits only normalized, aggregate-safe
reported metrics and field-level quality warnings. It deliberately does not alter
the separately governed location artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

DEFAULT_CLOUD = Path.home() / "OneDrive" / "GridPulse-Data" / "rzreg"

FIELD_MAP = {
    "Connected Load IT (kW)": "connected_it_kw",
    "Connected Load Non-Redundant (kW)": "connected_non_redundant_kw",
    "Total Consumption (kWh)": "annual_electricity_kwh",
    "REF": "renewable_energy_factor_pct",
    "PUE": "pue",
    "ERF": "energy_reuse_factor_pct",
    "Cooling Efficiency Ratio": "cooling_efficiency_ratio",
    "WUE": "wue_l_per_kwh_it",
    "Waste Heat Released (kWh)": "waste_heat_released_kwh",
    "Waste Heat Reused (kWh)": "waste_heat_reused_kwh",
}


def number(value: object) -> float | None:
    parsed = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    return None if pd.isna(parsed) else float(parsed)


def warnings_for(values: dict[str, float | None]) -> list[str]:
    warnings: list[str] = []
    ranges = {
        "connected_it_kw": (0, 250_000),
        "connected_non_redundant_kw": (0, 500_000),
        "annual_electricity_kwh": (0, 5_000_000_000),
        "renewable_energy_factor_pct": (0, 100),
        "pue": (1, 3),
        "energy_reuse_factor_pct": (0, 100),
        "cooling_efficiency_ratio": (0, 50),
        "wue_l_per_kwh_it": (0, 20),
        "waste_heat_released_kwh": (0, 5_000_000_000),
        "waste_heat_reused_kwh": (0, 5_000_000_000),
    }
    for key, value in values.items():
        if value is None:
            warnings.append(f"{key}:missing")
            continue
        minimum, maximum = ranges[key]
        if value < minimum or value > maximum:
            warnings.append(f"{key}:outside_validation_range")
    released = values["waste_heat_released_kwh"]
    reused = values["waste_heat_reused_kwh"]
    if released is not None and reused is not None and reused > released:
        warnings.append("waste_heat_reused_kwh:exceeds_released")
    return warnings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_CLOUD / "Rechenzentren-Verzeichnis.xlsx")
    parser.add_argument("--output", type=Path, default=Path("public/power-finder/rzreg-performance.json"))
    args = parser.parse_args()
    frame = pd.read_excel(args.input, sheet_name="Datacenters")
    records = []
    warning_count = 0
    for index, row in frame.iterrows():
        metrics = {normalized: number(row.get(source)) for source, normalized in FIELD_MAP.items()}
        warnings = warnings_for(metrics)
        warning_count += len(warnings)
        records.append({
            "id": f"rzreg-{index + 2}",
            "name": str(row.get("Name", "")).strip(),
            "operator": str(row.get("Operator", "")).strip(),
            "postcode": str(row.get("Postal Code", "")).split(".")[0].zfill(5),
            "size_class": str(row.get("Size Class", "")).strip(),
            "surface_area_m2": number(row.get("Surface Area (m�)")),
            "metrics": metrics,
            "validation_warnings": warnings,
        })
    artifact = {
        "schema_version": "gridpulse.rzreg-performance.v1",
        "metadata": {
            "publisher": "Bundesamt für Wirtschaft und Ausfuhrkontrolle (RZReg)",
            "source_file": args.input.name,
            "source_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
            "generated_at": datetime.fromtimestamp(args.input.stat().st_mtime, timezone.utc).isoformat(),
            "record_count": len(records),
            "validation_warning_count": warning_count,
            "truth_class": "public_operator_reported_context",
            "permitted_use": "Aggregate peer benchmarking with field-level validation.",
            "prohibited_use": "Nodal capacity, connection feasibility, or operator-confirmed claims.",
        },
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(artifact["metadata"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
