"""Build a frozen top-five 50Hertz pre-application and reconciliation package."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

METHODOLOGY_VERSION = "50hertz-top-five-preapplication-v1"

PUBLIC_SOURCES = {
    "50hertz_connection": {
        "url": "https://www.50hertz.com/de/Vertragspartner/Netzkunden/Netzanschluss",
        "use": "Non-binding connection-capacity context and official application route.",
    },
    "50hertz_total_load": {
        "url": "https://www.50hertz.com/Transparency/GridData/Gridfigures/Totalload",
        "use": "Definition and source route for control-area total load; not nodal SCADA.",
    },
    "50hertz_outages": {
        "url": "https://www.50hertz.com/en/Transparency/GridData/Congestionmanagement/OutageandPlanning",
        "use": "Public market-relevant outage evidence; not the full security list.",
    },
    "50hertz_hamburg_ost": {
        "url": "https://www.50hertz.com/de/Netz/Netzausbau/ProjekteanLand/UmspannwerkHamburgOst",
        "use": "Official substation restructuring and four phase-shifting transformers.",
    },
    "50hertz_project_51": {
        "url": "https://www.50hertz.com/de/Netz/Netzausbau/ProjekteanLand/Vorhaben51/%7B/",
        "use": "Official planned Hamburg/Ost reinforcement; two 380 kV circuits at 4,000 A.",
    },
    "mastr": {
        "url": "https://www.marktstammdatenregister.de/MaStR/Datendownload",
        "use": "Official public generation, storage and consumption-unit master-data source.",
    },
    "osm": {
        "url": "https://www.openstreetmap.org/",
        "use": "Public candidate names, coordinates, operator tags and nominal voltages.",
    },
}


def _sha(payload: Any) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _evidence(field: str, value: Any, evidence_class: str, source: str, note: str) -> dict:
    return {
        "field": field,
        "value": value,
        "evidence_class": evidence_class,
        "source": source,
        "note": note,
    }


def _site_public_evidence(site: dict) -> list[dict]:
    rows = [
        _evidence("location", site["location"], "public_open_mapping", "osm",
                  "Mapped substation name; operator spelling and completeness are not guaranteed."),
        _evidence("coordinates", site["coordinates"], "public_open_mapping", "osm",
                  "Mapped feature centroid, not an approved connection-bay coordinate."),
        _evidence("nominal_voltage_kv", site["mapped_voltage_kv"],
                  "public_open_mapping", "osm",
                  "Public voltage tag; busbar arrangement is unknown."),
    ]
    if site["location"] == "Hamburg/Ost":
        rows.extend([
            _evidence("substation_restructuring", "four phase-shifting transformers",
                      "official_50hertz_public", "50hertz_hamburg_ost",
                      "Official project fact; individual ratings and current states are not published."),
            _evidence("planned_reinforcement", "two 380 kV circuits, 4,000 A each",
                      "official_50hertz_public", "50hertz_project_51",
                      "Planned project parameter, not an available-capacity allocation."),
            _evidence("observed_public_outage", "Hamburg/Ost-Hamburg/Süd circuit 971",
                      "official_50hertz_public", "50hertz_outages",
                      "Published market-relevant outage example; not a complete contingency policy."),
        ])
    return rows


def build_preapplication_package(
    regional_artifact: Path,
    output: Path,
    request_markdown: Path,
    *,
    requested_mw: float = 500.0,
    target_year: int = 2030,
) -> dict[str, Any]:
    regional_bytes = regional_artifact.read_bytes()
    regional = json.loads(regional_bytes)
    top_five = regional["results"][:5]
    project = {
        "project_type": "large flexible electricity consumer",
        "requested_import_mw": requested_mw,
        "target_connection_year": target_year,
        "load_profile": "synthetic flat 24/7 demand at requested MW",
        "power_factor": 0.97,
        "maximum_ramp_mw_per_minute": 10.0,
        "interruptible_fraction": 0.20,
        "maximum_interruption_hours_per_event": 6,
        "bess_power_mw": round(requested_mw * 0.20, 3),
        "bess_energy_mwh": round(requested_mw * 0.20 * 4, 3),
        "bess_duration_hours": 4,
        "connection_voltage_preference_kv": 380,
        "evidence_class": "applicant_assumption_to_be_confirmed",
    }
    dossiers = []
    for site in top_five:
        firm = site["firm_proxy"]
        queue_derating = 0.15  # explicit mock because no complete prioritised queue is public
        queue_adjusted_p10 = round(firm["p10_mw"] * (1 - queue_derating), 2)
        flex = float(site["flexible_proxy_mw"])
        bess = float(site["bess_assisted_proxy_mw"])
        fields = _site_public_evidence(site)
        fields.extend([
            _evidence("electrical_topology", "synthetic nearest-neighbour mesh", "mocked",
                      "gridpulse_regional_model", "Must be replaced by an authorized network model."),
            _evidence("equipment_ratings", site["electrical_scenarios"], "simulated_range",
                      "gridpulse_regional_model", "Not actual line or transformer ratings."),
            _evidence("operating_state", "27 deterministic hourly scenario classes", "simulated",
                      "gridpulse_hourly_model", "50Hertz total load is zonal and cannot create nodal SCADA."),
            _evidence("contingencies", "incident synthetic line outages", "mocked",
                      "gridpulse_regional_model", "Public outage notices do not equal the approved security list."),
            _evidence("connection_queue", {"derating_fraction": queue_derating}, "mocked",
                      "gridpulse_queue_proxy", "No complete public prioritised queue with reserved MW was found."),
        ])
        prediction = {
            "site_rank": site["rank"],
            "p10_firm_proxy_mw": firm["p10_mw"],
            "central_firm_proxy_mw": firm["central_mw"],
            "p90_firm_proxy_mw": firm["p90_mw"],
            "queue_adjusted_p10_proxy_mw": queue_adjusted_p10,
            "flexible_proxy_mw": flex,
            "bess_assisted_proxy_mw": bess,
            "requested_mw": requested_mw,
            "p10_project_margin_mw": round(firm["p10_mw"] - requested_mw, 2),
            "queue_adjusted_project_margin_mw": round(queue_adjusted_p10 - requested_mw, 2),
            "central_project_margin_mw": round(firm["central_mw"] - requested_mw, 2),
            "passes_p10_screen": requested_mw <= firm["p10_mw"],
            "passes_mock_queue_adjusted_screen": requested_mw <= queue_adjusted_p10,
            "passes_flexible_screen": requested_mw <= flex,
            "passes_bess_screen": requested_mw <= bess,
            "binding_constraint": site["binding_constraint"],
            "binding_case": site["binding_case"],
            "capacity_claim": False,
            "display_as_capacity": False,
        }
        dossiers.append({
            "candidate_id": site["candidate_id"],
            "location": site["location"],
            "coordinates": site["coordinates"],
            "public_source_url": site["source_url"],
            "evidence_ledger": fields,
            "frozen_prediction": prediction,
            "prediction_sha256": _sha(prediction),
            "operator_questions": [
                "What connection bus and bay would 50Hertz study for this project?",
                "What normal and emergency equipment ratings apply?",
                "Which base cases, outages and security criteria govern the decision?",
                "What prior queue commitments and reinforcements affect the requested year?",
                "What firm, flexible and staged MW envelope would 50Hertz approve?",
            ],
        })
    freeze = {
        "methodology_version": METHODOLOGY_VERSION,
        "regional_input_sha256": hashlib.sha256(regional_bytes).hexdigest(),
        "project_sha256": _sha(project),
        "site_prediction_hashes": {row["candidate_id"]: row["prediction_sha256"] for row in dossiers},
        "frozen_before_operator_outcome": True,
    }
    reconciliation_schema = {
        "required_operator_fields": [
            "operator_case_id", "candidate_id", "studied_connection_bus", "study_timestamp",
            "study_year", "approved_firm_mw", "approved_flexible_mw", "approved_bess_mw",
            "binding_constraint", "critical_contingency", "queue_treatment",
            "reinforcements_required", "validity_conditions", "reviewer", "evidence_hash",
        ],
        "metrics_after_response": [
            "absolute_error_mw", "percentage_error", "optimistic_or_conservative",
            "constraint_match", "contingency_match", "project_fit_classification_match",
        ],
        "status": "awaiting_authorized_50hertz_outcome",
    }
    package = {
        "schema_version": "gridpulse-50hertz-preapplication-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "methodology_version": METHODOLOGY_VERSION,
        "project": project,
        "public_sources": PUBLIC_SOURCES,
        "site_dossiers": dossiers,
        "freeze_manifest": freeze,
        "reconciliation_schema": reconciliation_schema,
        "summary": {
            "site_count": len(dossiers),
            "requested_mw": requested_mw,
            "passes_p10_count": sum(d["frozen_prediction"]["passes_p10_screen"] for d in dossiers),
            "passes_mock_queue_adjusted_count": sum(
                d["frozen_prediction"]["passes_mock_queue_adjusted_screen"] for d in dossiers
            ),
            "operator_reconciled_count": 0,
        },
        "capacity_claim": False,
        "operator_confirmed": False,
        "prohibited_interpretation": "Not an available-capacity result or a 50Hertz response.",
    }
    package["package_sha256"] = _sha(package)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(package, indent=2), encoding="utf-8")
    request_markdown.parent.mkdir(parents=True, exist_ok=True)
    request_markdown.write_text(_request_document(package), encoding="utf-8")
    return package


def _request_document(package: dict[str, Any]) -> str:
    project = package["project"]
    site_rows = "\n".join(
        f"- {row['location']}: {row['coordinates'][1]}, {row['coordinates'][0]}"
        for row in package["site_dossiers"]
    )
    hashes = "\n".join(
        f"- {row['location']}: `{row['prediction_sha256']}`"
        for row in package["site_dossiers"]
    )
    return f"""# Draft 50Hertz grid-connection pre-application

## Status

Draft for applicant review and submission through the official 50Hertz grid-connection channel.
It has not been sent and is not a 50Hertz response.

## Project

- Type: {project['project_type']}
- Requested import: {project['requested_import_mw']} MW
- Target year: {project['target_connection_year']}
- Preferred voltage: {project['connection_voltage_preference_kv']} kV
- Power factor: {project['power_factor']}
- Maximum ramp: {project['maximum_ramp_mw_per_minute']} MW/min
- Interruptible fraction: {project['interruptible_fraction'] * 100:.0f}%
- BESS: {project['bess_power_mw']} MW / {project['bess_energy_mwh']} MWh

## Candidate locations

{site_rows}

## Requested 50Hertz outputs

For each technically relevant candidate, please provide or confirm:

1. The appropriate connection bus, voltage, bay and study boundary.
2. Firm import capability for the stated project and target year.
3. Flexible, interruptible, staged and BESS-assisted alternatives.
4. Applicable normal/emergency ratings, voltage limits and reactive-power requirements.
5. Governing base cases, critical contingencies and planned outages.
6. Treatment of prior queue commitments and planned reinforcements.
7. Binding constraint, required reinforcement, cost/timing process and validity conditions.
8. Permission and conditions for confidential numerical reconciliation.

## Prediction freeze

GridPulse synthetic predictions were frozen before an operator outcome. They are supplied for
method comparison only and are not asserted as available capacity.

{hashes}

Package hash: `{package['package_sha256']}`
"""
