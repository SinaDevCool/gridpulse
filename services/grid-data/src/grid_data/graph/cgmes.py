from __future__ import annotations

import hashlib
import json
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

REQUIRED_PROFILES = frozenset({"EQ", "SSH", "TP", "SV"})
PROFILE_MARKERS = {
    "EQUIPMENT": "EQ",
    "STEADYSTATEHYPOTHESIS": "SSH",
    "TOPOLOGY": "TP",
    "STATEVARIABLES": "SV",
}


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


@dataclass(frozen=True)
class CgmesEntity:
    mrid: str
    kind: str
    properties: dict[str, str]
    references: dict[str, str]
    profiles: tuple[str, ...]


@dataclass(frozen=True)
class CgmesPackage:
    model_id: str
    version: str
    entities: tuple[CgmesEntity, ...]
    profiles: tuple[str, ...]
    source_sha256: str
    manifest: dict[str, object]


def _documents(paths: Iterable[Path]) -> list[tuple[str, bytes]]:
    result: list[tuple[str, bytes]] = []
    for path in paths:
        if path.suffix.lower() == ".zip":
            with zipfile.ZipFile(path) as archive:
                result.extend(
                    (name, archive.read(name))
                    for name in sorted(archive.namelist())
                    if name.lower().endswith((".xml", ".rdf"))
                )
        else:
            result.append((path.name, path.read_bytes()))
    return result


def _profile(name: str, root: ET.Element) -> str | None:
    upper = name.upper()
    for code in REQUIRED_PROFILES:
        if f"_{code}" in upper or upper.startswith(code):
            return code
    text = " ".join(
        (element.text or "") for element in root.iter() if _local(element.tag).lower() == "profile"
    ).upper()
    return next((code for marker, code in PROFILE_MARKERS.items() if marker in text), None)


def parse_cgmes_package(paths: Iterable[Path], *, model_id: str, version: str) -> CgmesPackage:
    docs = _documents(paths)
    if not docs:
        raise ValueError("CGMES package contains no XML/RDF documents.")
    merged: dict[str, dict[str, object]] = {}
    profiles: set[str] = set()
    files: list[dict[str, object]] = []
    digest = hashlib.sha256()
    for name, payload in sorted(docs):
        digest.update(name.encode())
        digest.update(payload)
        root = ET.fromstring(payload)
        profile = _profile(name, root)
        if profile:
            profiles.add(profile)
        files.append(
            {
                "name": name,
                "profile": profile,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "bytes": len(payload),
            }
        )
        for element in root:
            identifier = next(
                (v.lstrip("#") for k, v in element.attrib.items() if _local(k) in {"ID", "about"}),
                None,
            )
            if not identifier or _local(element.tag) == "FullModel":
                continue
            row = merged.setdefault(
                identifier,
                {
                    "kind": _local(element.tag),
                    "properties": {},
                    "references": {},
                    "profiles": set(),
                },
            )
            if row["kind"] != _local(element.tag):
                raise ValueError(f"CGMES mRID {identifier} has conflicting types.")
            if profile:
                row["profiles"].add(profile)
            for child in element:
                key = _local(child.tag).split(".")[-1]
                resource = next(
                    (v.lstrip("#") for k, v in child.attrib.items() if _local(k) == "resource"),
                    None,
                )
                target = row["references"] if resource else row["properties"]
                target[key] = resource or (child.text or "").strip()
    missing_profiles = sorted(REQUIRED_PROFILES - profiles)
    if missing_profiles:
        raise ValueError(f"CGMES package missing required profiles: {', '.join(missing_profiles)}")
    dangling = sorted(
        {ref for row in merged.values() for ref in row["references"].values() if ref not in merged}
    )
    if dangling:
        raise ValueError(f"CGMES package has dangling references: {', '.join(dangling[:10])}")
    entities = tuple(
        CgmesEntity(
            key,
            str(row["kind"]),
            dict(row["properties"]),
            dict(row["references"]),
            tuple(sorted(row["profiles"])),
        )
        for key, row in sorted(merged.items())
    )
    manifest = {
        "model_id": model_id,
        "version": version,
        "profiles": sorted(profiles),
        "files": files,
        "entity_count": len(entities),
        "validation_class": "operator_model_unvalidated",
        "display_as_capacity": False,
    }
    manifest["manifest_sha256"] = hashlib.sha256(
        json.dumps(manifest, sort_keys=True).encode()
    ).hexdigest()
    return CgmesPackage(
        model_id, version, entities, tuple(sorted(profiles)), digest.hexdigest(), manifest
    )
