"""Fail-closed CGMES 2.4.15/3.0 import into a versioned pandapower model."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_PROFILES = {"EQ", "SSH", "TP", "SV"}


def inspect_cgmes_files(paths: list[Path]) -> dict[str, Any]:
    if not paths:
        raise ValueError("At least one CGMES XML or ZIP file is required.")
    profiles: set[str] = set()
    digest = hashlib.sha256()
    files = []
    for path in sorted(paths, key=lambda item: item.name):
        if path.suffix.lower() not in {".xml", ".zip"}:
            raise ValueError(f"Unsupported CGMES file type: {path.name}")
        if not path.is_file():
            raise ValueError(f"CGMES file does not exist: {path}")
        content = path.read_bytes()
        digest.update(path.name.encode())
        digest.update(content)
        upper_name = path.name.upper()
        profiles.update(
            profile
            for profile in REQUIRED_PROFILES
            if re.search(rf"(^|[_\-.]){profile}([_\-.]|$)", upper_name)
        )
        files.append({"name": path.name, "bytes": len(content)})
    missing = sorted(REQUIRED_PROFILES - profiles)
    if missing:
        raise ValueError(f"CGMES steady-state package is missing profiles: {', '.join(missing)}")
    return {"sha256": digest.hexdigest(), "profiles": sorted(profiles), "files": files}


def import_cgmes_model(
    paths: list[Path],
    output_model: Path,
    output_manifest: Path,
    *,
    model_key: str,
    model_version: str,
    source_url: str,
    licence: str,
    cgmes_version: str = "3.0",
) -> dict[str, Any]:
    if cgmes_version not in {"2.4.15", "3.0"}:
        raise ValueError("CGMES version must be 2.4.15 or 3.0.")
    if not source_url.startswith("https://") or not licence.strip():
        raise ValueError("A HTTPS source URL and explicit licence/reuse basis are required.")
    package = inspect_cgmes_files(paths)
    try:
        import pandapower as pp  # type: ignore[import-not-found]
        from pandapower.converter.cim import from_cim as cim2pp  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError("Install pandapower with converter support.") from error
    net = cim2pp.from_cim(
        file_list=[str(path) for path in paths],
        cgmes_version=cgmes_version,
        ignore_errors=False,
        run_powerflow=False,
    )
    if net.bus.empty or (net.line.empty and net.trafo.empty):
        raise ValueError("CGMES conversion produced no usable AC network.")
    if net.ext_grid.empty:
        raise ValueError("CGMES model has no external network injection/slack source.")
    for table_name in ("bus", "line", "trafo"):
        table = getattr(net, table_name)
        if not table.empty and "origin_id" not in table.columns:
            raise ValueError(f"Converted {table_name} table lacks CGMES origin identifiers.")
    pp.runpp(net, algorithm="nr", calculate_voltage_angles=True, init="auto", numba=False)
    if not net.converged:
        raise ValueError("Imported CGMES base case did not converge.")
    output_model.parent.mkdir(parents=True, exist_ok=True)
    pp.to_json(net, str(output_model))
    model_sha256 = hashlib.sha256(output_model.read_bytes()).hexdigest()
    manifest = {
        "schema_version": "gridpulse-c1-cgmes-import-v1",
        "model_key": model_key,
        "model_version": model_version,
        "validation_class": "operator_model_unvalidated",
        "cgmes_version": cgmes_version,
        "source_url": source_url,
        "licence": licence,
        "source_package": package,
        "model_sha256": model_sha256,
        "model_format": "pandapower-json",
        "element_counts": {
            "buses": len(net.bus),
            "lines": len(net.line),
            "transformers": len(net.trafo),
            "loads": len(net.load),
            "generators": len(net.sgen) + len(net.gen) + len(net.ext_grid),
            "switches": len(net.switch),
        },
        "base_case": {
            "converged": True,
            "minimum_voltage_pu": float(net.res_bus.vm_pu.min()),
            "maximum_voltage_pu": float(net.res_bus.vm_pu.max()),
        },
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "promotion_boundary": "Unvalidated operator model. Reconciliation and operator review are required before publication.",
    }
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
