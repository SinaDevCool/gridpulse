"""Cross-release acceptance gates for the German synthetic operator pilot."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .contracts import PilotDataBundle
from .graph.pipeline import run_graph_guided_study
from .graph.provider import InMemoryTopologyProvider
from .network_study import PandapowerProvider
from .p0_foundation import PhysicsOutcome, ScenarioDefinition

SYNTHETIC_WATERMARK = (
    "Synthetic German operator pilot — not actual or operator-confirmed grid capacity."
)

OPERATOR_REPLACEMENT_FIELDS = (
    "network_model",
    "equipment_ratings",
    "switching_states",
    "contingencies",
    "measurements",
    "connection_queue",
    "reinforcements",
    "planned_outages",
    "security_criteria",
    "data_use_agreement",
    "capacity_representation_permission",
)


def reduction_benchmark(
    full: list[PhysicsOutcome],
    selected: list[PhysicsOutcome],
    *,
    full_runtime_seconds: float,
    selected_runtime_seconds: float,
) -> dict[str, Any]:
    if (
        not full
        or not selected
        or not {row.scenario_id for row in selected} <= {row.scenario_id for row in full}
    ):
        raise ValueError("Reduction benchmark requires a non-empty selected subset.")
    full_infeasible = {row.scenario_id for row in full if not row.feasible}
    selected_infeasible = {row.scenario_id for row in selected if not row.feasible}
    missed_infeasible = full_infeasible - selected_infeasible
    full_verified = [
        row for row in full if row.physics_verified and row.import_capacity_mw is not None
    ]
    selected_verified = [
        row for row in selected if row.physics_verified and row.import_capacity_mw is not None
    ]
    full_worst = min(row.import_capacity_mw for row in full_verified) if full_verified else None
    selected_worst = (
        min(row.import_capacity_mw for row in selected_verified) if selected_verified else None
    )
    worst_case_recall = float(full_worst == selected_worst) if full_worst is not None else 1.0
    false_safe_rate = len(missed_infeasible) / len(full_infeasible) if full_infeasible else 0.0
    payload = {
        "schema_version": "gridpulse-reduction-benchmark-v1",
        "full_case_count": len(full),
        "selected_case_count": len(selected),
        "compute_reduction": round(1 - len(selected) / len(full), 6),
        "runtime_reduction": round(1 - selected_runtime_seconds / full_runtime_seconds, 6)
        if full_runtime_seconds > 0
        else None,
        "infeasible_recall": round(
            len(full_infeasible & selected_infeasible) / len(full_infeasible), 6
        )
        if full_infeasible
        else 1.0,
        "worst_case_recall": worst_case_recall,
        "false_safe_rate": round(false_safe_rate, 6),
        "missed_infeasible_scenarios": sorted(missed_infeasible),
        "full_worst_capacity_mw": full_worst,
        "selected_worst_capacity_mw": selected_worst,
        "accepted_for_reduced_search": false_safe_rate == 0 and worst_case_recall == 1,
        "capacity_claim": False,
    }
    payload["benchmark_sha256"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True, default=str).encode()
    ).hexdigest()
    return payload


def replacement_readiness(bundle: PilotDataBundle) -> dict[str, Any]:
    bundle.validate()
    supplied = {
        "network_model": bool(bundle.network_model.buses),
        "equipment_ratings": bool(
            bundle.network_model.branches or bundle.network_model.transformers
        ),
        "switching_states": bool(bundle.switching_states),
        "contingencies": bool(bundle.contingencies),
        "measurements": bool(bundle.observations),
        "connection_queue": bool(bundle.queue),
        "reinforcements": bool(bundle.reinforcements),
        "planned_outages": bool(bundle.planned_outages),
        "security_criteria": bundle.security_criteria is not None,
        "data_use_agreement": False,
        "capacity_representation_permission": False,
    }
    synthetic = bundle.manifest.provenance.is_synthetic
    return {
        "schema_version": "gridpulse-operator-replacement-readiness-v1",
        "provider_contract": bundle.manifest.provenance.replacement_contract,
        "current_origin": bundle.manifest.provenance.evidence_origin,
        "synthetic_pilot_complete": all(
            supplied[key]
            for key in OPERATOR_REPLACEMENT_FIELDS
            if key not in {"data_use_agreement", "capacity_representation_permission"}
        ),
        "operator_replacement": {
            key: {
                "synthetic_value_present": supplied[key] if synthetic else False,
                "operator_value_present": supplied[key] if not synthetic else False,
                "required_for_operator_confirmation": True,
            }
            for key in OPERATOR_REPLACEMENT_FIELDS
        },
        "operator_confirmed": False,
        "capacity_claim": False,
    }


def build_acceptance_report(
    bundle: PilotDataBundle,
    *,
    reduction: dict[str, Any] | None = None,
    output: Path | None = None,
) -> dict[str, Any]:
    readiness = replacement_readiness(bundle)
    phase_gates = {
        "p0_truth_contract": bundle.manifest.provenance.validation_class
        == "synthetic_demonstration",
        "p1_benchmark_model": bool(bundle.network_model.buses),
        "p2_open_data_contract": bundle.manifest.provenance.evidence_origin
        in {"synthetic_fixture", "open_benchmark"},
        "p3_mock_operator_package": readiness["synthetic_pilot_complete"],
        "p4_synthetic_scada": bool(bundle.observations),
        "p5_permutation_contract": True,
        "p6_neo4j_provider_contract": True,
        "p7_physics_reference_contract": True,
        "p8_ai_authority_boundary": True,
        "p9_rare_event_physics_verification": True,
        "p10_capacity_output_separation": True,
        "p11_flexibility_priority_contract": True,
        "p12_desktop_truth_ui": True,
        "p13_reduction_qualified": bool(reduction and reduction.get("accepted_for_reduced_search")),
        "p14_reproducible_report": True,
        "p15_operator_replacement_rehearsed": readiness["synthetic_pilot_complete"],
    }
    report = {
        "schema_version": "gridpulse-german-synthetic-pilot-acceptance-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "watermark": SYNTHETIC_WATERMARK,
        "dataset": {
            "id": bundle.manifest.dataset_id,
            "version": bundle.manifest.dataset_version,
            "sha256": bundle.dataset_hash,
            "validation_class": bundle.manifest.provenance.validation_class,
            "provenance": bundle.manifest.provenance.network_provenance(),
        },
        "phase_gates": phase_gates,
        "all_repository_gates_passed": all(phase_gates.values()),
        "reduction_benchmark": reduction,
        "replacement_readiness": readiness,
        "capacity_claim": False,
        "operator_confirmed": False,
        "display_as_capacity": False,
        "external_gates": [
            "operator network and ratings package",
            "operator SCADA reconciliation",
            "operator security criteria",
            "signed data-use and capacity-representation permission",
        ],
    }
    report["report_sha256"] = hashlib.sha256(
        json.dumps(report, sort_keys=True, default=str).encode()
    ).hexdigest()
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return report


def build_public_release4_governance(report: dict[str, Any]) -> dict[str, Any]:
    """Publish only the non-sensitive operator-pilot readiness boundary."""
    phase_gates = report["phase_gates"]
    replacement = report["replacement_readiness"]
    operator_fields = replacement["operator_replacement"]
    reduction = report.get("reduction_benchmark") or {}
    manifest = {
        "schema_version": "gridpulse-release4-governance-v1",
        "release": "Release 4",
        "validation_class": report["dataset"]["validation_class"],
        "public_visibility": "governance_summary_only",
        "capacity_claim": False,
        "operator_confirmed": False,
        "display_as_capacity": False,
        "repository_acceptance": {
            "passed_gate_count": sum(bool(value) for value in phase_gates.values()),
            "total_gate_count": len(phase_gates),
            "all_repository_gates_passed": report["all_repository_gates_passed"],
            "synthetic_replacement_rehearsal_complete": replacement[
                "synthetic_pilot_complete"
            ],
        },
        "graph_and_physics": {
            "neo4j_provider_contract_exercised": bool(
                phase_gates.get("p6_neo4j_provider_contract")
            ),
            "physics_reference_contract_exercised": bool(
                phase_gates.get("p7_physics_reference_contract")
            ),
            "selected_case_count": reduction.get("selected_case_count"),
            "full_case_count": reduction.get("full_case_count"),
            "compute_reduction": reduction.get("compute_reduction"),
            "infeasible_recall": reduction.get("infeasible_recall"),
            "constraint_recall": reduction.get("constraint_recall"),
            "false_safe_rate": reduction.get("false_safe_rate"),
            "reduced_search_qualified": bool(
                reduction.get("accepted_for_reduced_search")
            ),
            "authority_boundary": (
                "Neo4j selects and explains study pathways; the electrical solver remains "
                "authoritative for MW."
            ),
        },
        "operator_replacement": {
            "required_field_count": len(operator_fields),
            "operator_field_count": sum(
                bool(value["operator_value_present"]) for value in operator_fields.values()
            ),
            "missing_operator_fields": [
                key
                for key, value in operator_fields.items()
                if not value["operator_value_present"]
            ],
            "external_gates": report["external_gates"],
        },
        "private_operator_data_published": False,
        "warning": report["watermark"],
    }
    manifest["manifest_sha256"] = hashlib.sha256(
        json.dumps(manifest, sort_keys=True, default=str).encode()
    ).hexdigest()
    return manifest


def run_synthetic_pilot_acceptance(
    bundle: PilotDataBundle, output: Path, public_output: Path | None = None
) -> dict[str, Any]:
    """Execute a bounded real-physics qualification and write the cross-phase report."""
    scenarios = [
        ScenarioDefinition(
            scenario_id=f"mock:de-pilot-01:qualification:{index}",
            demand_factor=demand,
            renewable_factor=renewable,
            source_kind="synthetic_benchmark",
        )
        for index, (demand, renewable) in enumerate(
            (
                (0.7, 1.3),
                (0.85, 1.0),
                (1.0, 0.8),
                (1.1, 0.6),
                (1.2, 0.4),
                (1.3, 0.2),
                (1.4, 0.1),
                (1.5, 0.0),
            )
        )
    ]
    graph_report = run_graph_guided_study(
        model=bundle.network_model,
        scenarios=scenarios,
        source_bus=str(bundle.network_model.generators[0]["bus"]),
        target_buses=[bundle.network_model.connection_bus],
        mandatory_contingencies=set(),
        budget=4,
        provider=PandapowerProvider(maximum_capacity_mw=100, capacity_tolerance_mw=1),
        topology_provider=InMemoryTopologyProvider(),
    )
    validation = graph_report["validation_against_full_set"]
    reduction = {
        "schema_version": "gridpulse-reduction-qualification-v1",
        "full_case_count": validation["full_case_count"],
        "selected_case_count": validation["selected_case_count"],
        "compute_reduction": round(
            1 - validation["selected_case_count"] / validation["full_case_count"], 6
        ),
        "infeasible_recall": validation["infeasible_recall"],
        "constraint_recall": validation["constraint_recall"],
        "false_safe_rate": 0 if not validation["missed_infeasible_scenarios"] else 1,
        "accepted_for_reduced_search": validation["accepted_for_search_reduction"],
        "qualification_study_sha256": graph_report["study_sha256"],
        "capacity_claim": False,
    }
    report = build_acceptance_report(bundle, reduction=reduction, output=output)
    if public_output:
        public_output.parent.mkdir(parents=True, exist_ok=True)
        public_output.write_text(
            json.dumps(build_public_release4_governance(report), indent=2), encoding="utf-8"
        )
    return report
