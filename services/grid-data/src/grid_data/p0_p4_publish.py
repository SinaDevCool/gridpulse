"""Service-role publication for the private P0-P4 computation ledger."""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path
from typing import Any


def _request(url: str, key: str, path: str, *, method: str, payload: Any) -> None:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{path}",
        data=json.dumps(payload, default=str).encode(),
        method=method,
        headers={
            "apikey": key,
            "authorization": f"Bearer {key}",
            "content-type": "application/json",
            "prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status >= 300:
            raise RuntimeError(f"P0-P4 ledger publication failed with HTTP {response.status}.")


def _upload_artifact(url: str, key: str, object_path: str, path: Path) -> None:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/storage/v1/object/grid-surrogate-models/{object_path}",
        data=path.read_bytes(),
        method="POST",
        headers={
            "apikey": key,
            "authorization": f"Bearer {key}",
            "content-type": "application/octet-stream",
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.status >= 300:
            raise RuntimeError(f"Release 2 artifact upload failed with HTTP {response.status}.")


def publish_pipeline_result(
    *,
    job: Any,
    result: dict[str, Any],
    scenarios: list[Any],
    surrogate_registry: dict[str, Any] | None = None,
    release2: dict[str, Any] | None = None,
    artifact_path: Path | None = None,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> dict[str, int]:
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return {"runs": 0, "results": 0, "models": 0, "release2_records": 0}
    provenance = result["provenance"]
    _request(
        url,
        key,
        "grid_scenario_runs?on_conflict=id",
        method="POST",
        payload={
            "id": str(job.id),
            "owner_id": str(job.owner_id),
            "pipeline_version": provenance["pipeline_version"],
            "model_id": provenance["model_id"],
            "model_version": provenance["model_version"],
            "validation_class": provenance["validation_class"],
            "dataset_hash": provenance["dataset_hash"],
            "phase": "p4",
            "status": "succeeded",
            "progress_completed": result["scenario_count"],
            "progress_total": result["scenario_count"],
            "configuration": {"scenario_count": result["scenario_count"]},
            "summary": {
                key: value for key, value in result.items() if key not in {"outcomes", "quarantine"}
            },
        },
    )
    by_id = {item.scenario_id: item for item in scenarios}
    rows = [
        {
            "run_id": str(job.id),
            "scenario_id": item["scenario_id"],
            "input_hash": item["input_hash"],
            "input_payload": by_id[item["scenario_id"]].__dict__,
            "source_kind": by_id[item["scenario_id"]].source_kind,
            "status": "succeeded",
            "import_capacity_mw": item["import_capacity_mw"],
            "export_capacity_mw": item["export_capacity_mw"],
            "binding_case": item["binding_case"],
            "binding_constraint": item["binding_constraint"],
            "physics_verified": item["physics_verified"],
            "solver": item["solver"],
            "solver_version": item["solver_version"],
        }
        for item in result["outcomes"]
    ]
    rows.extend(
        {
            "run_id": str(job.id),
            "scenario_id": item["scenario_id"],
            "input_hash": item["input_hash"],
            "input_payload": by_id[item["scenario_id"]].__dict__,
            "source_kind": by_id[item["scenario_id"]].source_kind,
            "status": "quarantined",
            "physics_verified": False,
            "error": {"type": item["error"], "message": item["message"]},
        }
        for item in result["quarantine"]
    )
    for start in range(0, len(rows), 500):
        _request(
            url,
            key,
            "grid_scenario_results?on_conflict=run_id,input_hash",
            method="POST",
            payload=rows[start : start + 500],
        )
    models = 0
    if surrogate_registry:
        _request(
            url,
            key,
            "grid_surrogate_models?on_conflict=owner_id,model_key,model_version",
            method="POST",
            payload={
                "owner_id": str(job.owner_id),
                "model_key": "p3-capacity-surrogate",
                "model_version": surrogate_registry["dataset_hash"][:16],
                "training_run_id": str(job.id),
                "dataset_hash": surrogate_registry["dataset_hash"],
                "feature_schema": surrogate_registry["feature_schema"],
                "hyperparameters": {
                    "algorithm": surrogate_registry["algorithm"],
                    "random_state": surrogate_registry["random_state"],
                },
                "metrics": surrogate_registry["metrics"],
                "training_validation_classes": surrogate_registry["training_validation_classes"],
                "operator_trained": surrogate_registry["operator_trained"],
                "approved_use": surrogate_registry["approved_use"],
                "prohibited_use": surrogate_registry["prohibited_use"],
                "status": "candidate",
            },
        )
        models = 1
    release2_records = 0
    if release2:
        artifact = release2.get("artifact")
        artifact_uri = None
        if artifact:
            artifact_uri = artifact.get("artifact_uri")
            if artifact_path:
                if not artifact_path.is_file():
                    raise FileNotFoundError("Release 2 artifact is missing before publication.")
                object_path = f"{job.owner_id}/{job.id}/{artifact['artifact_sha256']}.joblib"
                _upload_artifact(url, key, object_path, artifact_path)
                artifact_uri = f"grid-surrogate-models/{object_path}"
            _request(
                url,
                key,
                "grid_surrogate_artifacts?on_conflict=run_id,artifact_sha256",
                method="POST",
                payload={
                    "run_id": str(job.id),
                    "dataset_hash": artifact["dataset_hash"],
                    "artifact_sha256": artifact["artifact_sha256"],
                    "size_bytes": artifact["size_bytes"],
                    "format": artifact["format"],
                    "artifact_uri": artifact_uri,
                    "public_visibility": artifact["public_visibility"],
                },
            )
            release2_records += 1
        updated_registry = release2["updated_model_registry"]
        _request(
            url,
            key,
            "grid_surrogate_models?on_conflict=owner_id,model_key,model_version",
            method="POST",
            payload={
                "owner_id": str(job.owner_id),
                "model_key": "p3-capacity-surrogate",
                "model_version": updated_registry["dataset_hash"][:16],
                "training_run_id": str(job.id),
                "dataset_hash": updated_registry["dataset_hash"],
                "feature_schema": updated_registry["feature_schema"],
                "hyperparameters": {
                    "algorithm": updated_registry["algorithm"],
                    "random_state": updated_registry["random_state"],
                    "split_method": updated_registry["split_method"],
                },
                "metrics": updated_registry["metrics"],
                "training_validation_classes": updated_registry["training_validation_classes"],
                "operator_trained": updated_registry["operator_trained"],
                "approved_use": updated_registry["approved_use"],
                "prohibited_use": updated_registry["prohibited_use"],
                "artifact_uri": artifact_uri,
                "status": "approved"
                if release2["promotion"]["decision"] == "promote"
                else "rejected",
            },
        )
        models += 1
        round_data = release2["active_learning_round"]
        _request(
            url,
            key,
            "grid_active_learning_rounds?on_conflict=run_id,round_number",
            method="POST",
            payload={
                "run_id": str(job.id),
                "round_number": 0,
                "candidate_count": round_data["candidate_count"],
                "selected_count": round_data["selected_count"],
                "mandatory_contingencies": round_data["mandatory_contingencies"],
                "acquisition_configuration": {
                    "version": "release2-acquisition-v1",
                    "selected_scenario_hash": round_data["selected_scenario_hash"],
                    "physics_coverage": round_data["physics_coverage"],
                    "mandatory_contingency_coverage": round_data[
                        "mandatory_contingency_coverage"
                    ],
                    "unverified_selected_scenario_hashes": round_data[
                        "unverified_selected_scenario_hashes"
                    ],
                },
                "prior_metrics": release2["initial_model_registry"]["metrics"],
                "new_metrics": release2["updated_model_registry"]["metrics"],
                "decision": release2["promotion"]["decision"],
                "rollback_required": release2["promotion"]["rollback_required"],
            },
        )
        prediction_rows = [
            {
                "run_id": str(job.id),
                "round_number": 0,
                **item,
            }
            for item in round_data["predictions"]
        ]
        for start in range(0, len(prediction_rows), 500):
            _request(
                url,
                key,
                "grid_active_learning_candidates?on_conflict=run_id,round_number,scenario_sha256",
                method="POST",
                payload=prediction_rows[start : start + 500],
            )
        _request(
            url,
            key,
            "grid_rare_event_results?on_conflict=run_id,search_version",
            method="POST",
            payload={
                "run_id": str(job.id),
                "search_version": "release2-rare-event-v1",
                "result": release2["rare_event_search"],
                "physics_verified": bool(release2["rare_event_search"]["verified_count"]),
            },
        )
        _request(
            url,
            key,
            "grid_model_promotion_decisions?on_conflict=run_id,model_dataset_hash",
            method="POST",
            payload={
                "run_id": str(job.id),
                "model_dataset_hash": release2["updated_model_registry"]["dataset_hash"],
                **release2["promotion"],
            },
        )
        release2_records += len(prediction_rows) + 3
    return {
        "runs": 1,
        "results": len(rows),
        "models": models,
        "release2_records": release2_records,
    }
