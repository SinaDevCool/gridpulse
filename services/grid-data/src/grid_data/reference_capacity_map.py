"""Build a governed multi-bus SimBench capacity-map demonstration artifact."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .benchmark_model import SIMBENCH_LICENSE, SIMBENCH_SOURCE, import_simbench_model
from .activatable_capacity import ActivationPolicy, calculate_activation_ensemble
from .graph.contracts import build_projection
from .graph.provider import configured_topology_provider
from .network_study import PandapowerProvider


def _candidate_buses(model, limit: int) -> list[str]:
    demand_by_bus: dict[str, float] = {}
    for load in model.loads:
        demand_by_bus[str(load["bus"])] = demand_by_bus.get(str(load["bus"]), 0.0) + float(
            load.get("p_mw", 0)
        )
    return [
        bus for bus, _ in sorted(demand_by_bus.items(), key=lambda row: (-row[1], row[0]))[:limit]
    ]


def build_reference_capacity_map_artifact(
    output: Path,
    code: str = "1-MV-urban--0-sw",
    limit: int = 12,
) -> dict[str, Any]:
    repo_root = Path(__file__).resolve().parents[4]
    fixture_root = repo_root / "services" / "grid-data" / "fixtures" / "synthetic-pilot"
    manifest = json.loads((fixture_root / "manifest.json").read_text(encoding="utf-8"))
    policy_payload = json.loads(
        (fixture_root / "activation-policy.json").read_text(encoding="utf-8")
    )
    evidence_manifest = {
        "network_model": {
            "origin": "SimBench",
            "class": "open_reference",
            "accepted_by_operator": False,
        },
        "topology_analysis": {
            "origin": "configured Neo4j-compatible topology provider",
            "class": "calculated_reference",
            "accepted_by_operator": False,
        },
        "electrical_ceiling": {
            "origin": "pandapower N-0/N-1 calculation",
            "class": "calculated_reference",
            "accepted_by_operator": False,
        },
        "operating_scenarios": {
            "origin": manifest["provenance"]["source_id"],
            "class": "synthetic",
            "accepted_by_operator": False,
        },
    }
    policy = ActivationPolicy(
        **{key: value for key, value in policy_payload.items() if key != "schema_version"}
    )
    release2_path = repo_root / "public" / "power-finder" / "release2-governance.json"
    release2 = (
        json.loads(release2_path.read_text(encoding="utf-8")) if release2_path.is_file() else None
    )
    release3_path = repo_root / "public" / "power-finder" / "release3-governance.json"
    release3 = (
        json.loads(release3_path.read_text(encoding="utf-8")) if release3_path.is_file() else None
    )
    release4_path = repo_root / "public" / "power-finder" / "release4-governance.json"
    release4 = (
        json.loads(release4_path.read_text(encoding="utf-8")) if release4_path.is_file() else None
    )
    model = import_simbench_model(code)
    projection = build_projection(model)
    topology = configured_topology_provider()
    audit, _ = topology.inspect(
        projection, source_bus=model.connection_bus, target_buses=_candidate_buses(model, limit)
    )
    bridge_assets = set(audit.get("bridge_assets", []))
    contingency_branches = [
        branch for branch in model.branches if branch["id"] not in bridge_assets
    ][:3]
    contingencies = [
        {"id": f"{branch['id']}-out", "element_type": "line", "element_id": branch["id"]}
        for branch in contingency_branches
    ]
    provider = PandapowerProvider(maximum_capacity_mw=100.0, capacity_tolerance_mw=0.1)
    results = []
    for index, bus_id in enumerate(_candidate_buses(model, limit)):
        base_model = replace(model, connection_bus=bus_id, contingencies=[])
        secured_model = replace(model, connection_bus=bus_id, contingencies=contingencies)
        n0 = provider.calculate_import_capacity(base_model)
        n1 = provider.calculate_import_capacity(secured_model)
        n0_mw = float(n0.values["firm_import_capacity_mw"])
        n1_mw = float(n1.values["firm_import_capacity_mw"])
        firm = min(n0_mw, n1_mw)
        ensemble = calculate_activation_ensemble(
            result_id=f"simbench-ref-{index + 1:02d}",
            electrical_ceiling_mw=n0_mw,
            n1_capacity_mw=n1_mw,
            policy=policy,
        )
        activation = ensemble.pop("central_result")
        results.append(
            {
                "result_id": f"simbench-ref-{index + 1:02d}",
                "reference_bus_id": bus_id,
                "label": f"REF {index + 1:02d}",
                "n0_capacity_mw": n0_mw,
                "n1_capacity_mw": n1_mw,
                "firm_capacity_mw": firm,
                "flexible_capacity_mw": activation["flexible"]["capacity_mw"],
                "bess_assisted_capacity_mw": activation["bess_assisted"]["capacity_mw"],
                "staged_initial_capacity_mw": activation["staged"]["initial_capacity_mw"],
                "eventual_capacity_mw": activation["staged"]["eventual_capacity_mw"],
                "activatable_capacity_mw": activation["activatable_capacity_mw"],
                "additional_unlocked_mw": activation["additional_unlocked_mw"],
                "activation": activation,
                "ensemble": ensemble,
                "release2_governance": release2,
                "release3_governance": release3,
                "release4_governance": release4,
                "binding_constraint": n1.values.get("binding_constraint"),
                "binding_case": n1.values.get("binding_case"),
                "validation_state": "reference_network_calculated",
                "graph_pathway_available": True,
            }
        )
    canonical = json.dumps(results, sort_keys=True, separators=(",", ":"))
    artifact = {
        "schema_version": "gridpulse-reference-capacity-map-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result_mode": "reference_network_calculated",
        "model": {
            "id": model.model_id,
            "version": model.model_version,
            "code": code,
            "source_url": SIMBENCH_SOURCE,
            "licence": SIMBENCH_LICENSE,
            "model_sha256": hashlib.sha256(
                json.dumps(asdict(model), sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest(),
            "graph_projection_sha256": projection.projection_sha256,
            "topology_provider": topology.name,
        },
        "solver": {"name": "pandapower-newton-raphson", "version": results and n1.solver_version},
        "security": {
            "criterion": "N-1 demonstration",
            "contingency_ids": [item["id"] for item in contingencies],
            "operator_approved_complete_set": False,
        },
        "strategy_assumptions": {
            "hourly_profile": "27 deterministic synthetic operating scenarios (236,520 hours) bounded by the solved N-0 electrical ceiling.",
            "flexibility": "Customer-side managed reduction follows the versioned activation policy.",
            "battery": "State-of-charge, reserve, efficiency, power and energy are enforced; dispatch is representative planning, not real-time control.",
            "staging": "Stages are representative; reinforcement scope and delivery dates are not modelled.",
        },
        "pilot_fixture": {
            "manifest": manifest,
            "evidence": evidence_manifest,
            "manifest_sha256": hashlib.sha256(
                json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest(),
            "evidence_sha256": hashlib.sha256(
                json.dumps(evidence_manifest, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest(),
        },
        "release2_governance": release2,
        "release3_governance": release3,
        "release4_governance": release4,
        "results_sha256": hashlib.sha256(canonical.encode()).hexdigest(),
        "results": results,
        "permitted_interpretation": "Calculated capacity on a SimBench reference network.",
        "prohibited_interpretation": "Not capacity at any mapped public node or named substation.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
