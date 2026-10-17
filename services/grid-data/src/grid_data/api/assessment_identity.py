"""Content identity for the exact payload and engine selected at submission."""

import hashlib
import json
import os
from importlib import metadata

from grid_data.api.version import SERVICE_VERSION


def execution_identity(job_type: str, payload: dict) -> tuple[str, dict]:
    try:
        engine = metadata.version("gridpulse-capacity-backtest")
    except metadata.PackageNotFoundError:
        engine = None
    manifest = {
        "schema_version": "gridpulse-execution-identity-v1",
        "service_version": SERVICE_VERSION,
        "engine_version": engine,
        "service_revision": os.environ.get("GRIDPULSE_BUILD_SHA", "development"),
        "engine_artifact_sha256": os.environ.get("GRIDPULSE_ENGINE_SHA256"),
        "job_type": job_type,
        "payload_sha256": hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
        ).hexdigest(),
    }
    fingerprint = hashlib.sha256(
        json.dumps(manifest, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()
    return fingerprint, manifest
