from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any


def _normalized(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _tokens(value: str | None) -> set[str]:
    return {token for token in _normalized(value).split() if len(token) > 2}


def _distance_m(left: dict[str, Any], right: dict[str, Any]) -> float:
    latitude = math.radians((float(left["latitude"]) + float(right["latitude"])) / 2)
    dx = (float(left["longitude"]) - float(right["longitude"])) * 111_320 * math.cos(latitude)
    dy = (float(left["latitude"]) - float(right["latitude"])) * 110_540
    return math.hypot(dx, dy)


def _voltage_overlap(left: dict[str, Any], right: dict[str, Any]) -> bool | None:
    left_values = {float(value) for value in left.get("voltage_kv", [])}
    right_values = {float(value) for value in right.get("voltage_kv", [])}
    return bool(left_values & right_values) if left_values and right_values else None


def propose_operator_matches(
    mapped_nodes: list[dict[str, Any]],
    operator_records: list[dict[str, Any]],
    *,
    maximum_distance_m: float = 5_000,
    minimum_confidence: float = 0.65,
) -> list[dict[str, Any]]:
    proposals: list[dict[str, Any]] = []
    for record in operator_records:
        candidates: list[dict[str, Any]] = []
        for node in mapped_nodes:
            distance = _distance_m(node, record)
            if distance > maximum_distance_m:
                continue
            left_tokens = _tokens(node.get("name"))
            right_tokens = _tokens(record.get("name"))
            shared = left_tokens & right_tokens
            name_score = len(shared) / max(len(left_tokens | right_tokens), 1)
            voltage = _voltage_overlap(node, record)
            operator_match = _normalized(record.get("operator")) in {
                _normalized(node.get("operator")),
                "50hertz transmission gmbh",
                "50hertz",
            }
            distance_score = max(0.0, 1 - distance / maximum_distance_m)
            confidence = (
                name_score * 0.45
                + distance_score * 0.25
                + (0.2 if voltage is True else 0.05 if voltage is None else 0)
                + (0.1 if operator_match else 0)
            )
            if confidence >= minimum_confidence:
                candidates.append(
                    {
                        "source_record_id": record["source_record_id"],
                        "node_source_record_id": node["source_record_id"],
                        "match_method": "name_voltage" if shared else "spatial",
                        "confidence": round(confidence, 4),
                        "distance_m": round(distance, 1),
                        "voltage_overlap": voltage,
                        "rationale": (
                            f"Proposed only: shared name tokens={sorted(shared)}; "
                            f"distance={distance:.0f} m; voltage_overlap={voltage}. "
                            "Human review is required before publication."
                        ),
                    }
                )
        if candidates:
            proposals.append(max(candidates, key=lambda candidate: candidate["confidence"]))
    return sorted(proposals, key=lambda proposal: proposal["confidence"], reverse=True)


def write_match_proposals(input_path: Path, output_path: Path) -> dict[str, Any]:
    source = json.loads(input_path.read_text(encoding="utf-8"))
    proposals = propose_operator_matches(
        source.get("mapped_nodes", []),
        source.get("operator_records", []),
    )
    report = {
        "schema_version": "operator-node-match-proposals-v1",
        "source_id": source.get("source_id"),
        "status": "proposed",
        "proposal_count": len(proposals),
        "proposals": proposals,
        "publication_boundary": (
            "Machine proposals are not public evidence. Each match must be accepted by a human "
            "reviewer before it can link operator evidence to a mapped node."
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report
