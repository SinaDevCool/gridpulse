"""Reproducible C3 benchmark using C2, SimBench and SMARD inputs."""

from __future__ import annotations

import json
import math
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .benchmark_model import import_simbench_model
from .c2_benchmark import _complete_year
from .c2_sources import fetch_smard_hourly
from .c3_security_flexibility import (
    FlexibilityPortfolio,
    OperatorSecurityCriteria,
    assess_security,
    build_fca_proposal,
    optimize_flexibility,
)
from .network_study import PandapowerProvider


def build_c3_benchmark_artifact(
    c2_path: Path,
    output: Path,
    *,
    year: int = 2023,
    code: str = "1-MV-urban--0-sw",
) -> dict[str, Any]:
    c2 = json.loads(c2_path.read_text(encoding="utf-8"))
    rows = [row for row in c2["envelope"]["hourly"] if row["weather_year"] == year]
    if not rows:
        raise ValueError(f"C2 artifact has no {year} hourly series.")
    prices_source = fetch_smard_hourly(
        start_year=year,
        end_year=year,
        filter_id="4169",
        metric="day_ahead_price",
        unit="EUR_per_MWh",
    )
    prices, imputed = _complete_year(
        dict(prices_source.values), year, maximum_missing_fraction=0.02
    )
    timestamps = [row["timestamp"] for row in rows]
    # Customer demand and onsite PV remain declared benchmark profiles. They are
    # intentionally not presented as observed site measurements.
    demand = []
    onsite = []
    for value in timestamps:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        business = 0.5 if timestamp.weekday() < 5 and 7 <= timestamp.hour < 19 else 0.0
        demand.append(2.6 + business)
        daylight = max(0.0, math.sin(math.pi * (timestamp.hour - 6) / 12))
        season = 0.35 + 0.65 * max(
            0.0, math.sin(math.pi * (timestamp.timetuple().tm_yday - 80) / 365)
        )
        onsite.append(round(1.2 * daylight * season, 5))
    import_limits = [float(row["capacity_mw"]) for row in rows]
    model = import_simbench_model(code)
    # A deterministic bounded outage set proves the engine path without implying
    # that it is the complete, operator-approved contingency list.
    benchmark_contingencies = [
        {"id": f"benchmark-outage-{item['id']}", "element_type": "line", "element_id": item["id"]}
        for item in model.branches[:12]
    ] + [
        {
            "id": f"benchmark-outage-{item['id']}",
            "element_type": "transformer",
            "element_id": item["id"],
        }
        for item in model.transformers
    ]
    model = replace(model, contingencies=benchmark_contingencies)
    provider = PandapowerProvider(maximum_capacity_mw=20, capacity_tolerance_mw=0.25)
    export_result = provider.calculate_export_capacity(model)
    export_firm = float(export_result.values.get("firm_export_capacity_mw", 0))
    export_limits = [export_firm] * len(rows)
    portfolio = FlexibilityPortfolio(
        battery_power_mw=2,
        battery_energy_mwh=6,
        flexible_load_mw=0.75,
        maximum_flexible_energy_mwh=365,
        battery_degradation_eur_mwh=7,
    )
    dispatch = optimize_flexibility(
        timestamps=timestamps,
        demand_mw=demand,
        onsite_generation_mw=onsite,
        import_envelope_mw=import_limits,
        export_envelope_mw=export_limits,
        price_eur_mwh=prices,
        portfolio=portfolio,
    )
    criteria = OperatorSecurityCriteria(
        criteria_id="vde-inspired-benchmark-criteria",
        version="1.0.0",
        reviewed_by_operator=False,
    )
    security = assess_security(model, criteria, provider=provider)
    fca_dynamic = build_fca_proposal(
        timestamps,
        import_limits,
        export_limits,
        contract_start=f"{year}-01-01",
        contract_end=f"{year}-12-31",
        mode="dynamic",
    )
    fca_static = build_fca_proposal(
        timestamps,
        import_limits,
        export_limits,
        contract_start=f"{year}-01-01",
        contract_end=f"{year}-12-31",
        mode="static",
    )
    artifact = {
        "schema_version": "gridpulse-c3-benchmark-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "validation_class": "synthetic_demonstration",
        "public_label": "Security and flexibility benchmark — not German node capacity",
        "model": c2["model"],
        "sources": c2["sources"]
        + [
            {
                "source_key": prices_source.source_key,
                "metric": prices_source.metric,
                "unit": prices_source.unit,
                "observation_count": len(prices_source.values),
                "provenance": prices_source.provenance,
            }
        ],
        "security": security,
        "flexibility": dispatch,
        "fca": {"dynamic": fca_dynamic, "static": fca_static},
        "data_quality": {"smard_price_imputed_hours": imputed},
        "evidence_boundary": (
            "SimBench network, C2 envelopes and declared customer/onsite profiles form a "
            "demonstration only. No German operator topology, SCADA, accepted queue, protection "
            "setting or approved contingency list is used. FCA outputs are non-binding proposals."
        ),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
