"""Runtime configuration and dependency probes; never a facility-readiness claim."""

from __future__ import annotations

import hashlib
import importlib.metadata
import os
import re
from collections.abc import Mapping
from pathlib import Path
from urllib.parse import urlparse


def validate_runtime(env: Mapping[str, str]) -> None:
    environment = env.get("GRIDPULSE_ENV", "development")
    if environment not in {"development", "test", "staging", "production"}:
        raise RuntimeError("Invalid GRIDPULSE_ENV")
    if environment not in {"staging", "production"}:
        return
    required = (
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GRIDPULSE_ALLOWED_ORIGINS",
        "GRIDPULSE_ENGINE_VERSION",
        "GRIDPULSE_BUILD_SHA",
        "GRIDPULSE_ENGINE_SHA256",
        "GRIDPULSE_CANONICAL_WHEEL",
    )
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise RuntimeError("Missing deployment settings: " + ", ".join(missing))
    if env.get("GRIDPULSE_JOB_DISPATCH_MODE") != "worker":
        raise RuntimeError("Deployed analytics requires durable worker dispatch")
    for origin in [env["SUPABASE_URL"], *env["GRIDPULSE_ALLOWED_ORIGINS"].split(",")]:
        parsed = urlparse(origin.strip())
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or parsed.hostname in {"localhost", "127.0.0.1"}
            or "*" in origin
        ):
            raise RuntimeError("Deployment origins must be explicit HTTPS origins")
    if not re.fullmatch(r"[0-9a-f]{40}", env["GRIDPULSE_BUILD_SHA"]):
        raise RuntimeError("GRIDPULSE_BUILD_SHA must identify an immutable commit")
    if not re.fullmatch(r"[0-9a-f]{64}", env["GRIDPULSE_ENGINE_SHA256"]):
        raise RuntimeError("GRIDPULSE_ENGINE_SHA256 must identify the approved artifact")
    artifact = Path(env["GRIDPULSE_CANONICAL_WHEEL"])
    if not artifact.is_file() or artifact.suffix != ".whl":
        raise RuntimeError("Approved canonical wheel is unavailable")
    with artifact.open("rb") as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
        if digest.hexdigest() != env["GRIDPULSE_ENGINE_SHA256"]:
            raise RuntimeError("Canonical artifact checksum mismatch")


def canonical_engine_ready() -> bool:
    try:
        version = importlib.metadata.version("gridpulse-capacity-backtest")
        from capacity_backtest.application import contract_manifest

        manifest = contract_manifest()
        expected = os.environ.get("GRIDPULSE_ENGINE_VERSION")
        return bool(manifest) and bool(expected) and version == expected
    except (
        ImportError,
        importlib.metadata.PackageNotFoundError,
        RuntimeError,
        ValueError,
        AttributeError,
    ):
        # An incompatible or broken artifact is unavailable, not a healthy deployment.
        return False
