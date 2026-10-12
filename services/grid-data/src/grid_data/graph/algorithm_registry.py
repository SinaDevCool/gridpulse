from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Any

from grid_data.p0_foundation import canonical_hash


@dataclass(frozen=True)
class AlgorithmDefinition:
    name: str
    version: str
    approved_use: str
    prohibited_use: tuple[str, ...]


ALGORITHMS = {
    "dijkstra": AlgorithmDefinition(
        "dijkstra",
        "gds-2",
        "least-cost topology pathway",
        ("electrical flow path", "available capacity"),
    ),
    "yen": AlgorithmDefinition(
        "yen",
        "gds-2",
        "alternative topology pathways",
        ("contingency compliance", "available capacity"),
    ),
    "astar": AlgorithmDefinition(
        "astar",
        "gds-2",
        "geographically guided topology pathway",
        ("electrical flow path", "available capacity"),
    ),
    "wcc": AlgorithmDefinition(
        "wcc", "gds-2", "island and connectivity screening", ("energisation status",)
    ),
    "bridges": AlgorithmDefinition(
        "bridges", "gds-2", "single-edge topology sensitivity", ("N-1 proof",)
    ),
    "articulation": AlgorithmDefinition(
        "articulation", "gds-2", "single-node topology sensitivity", ("N-1 proof",)
    ),
    "betweenness": AlgorithmDefinition(
        "betweenness", "gds-2", "topological centrality prioritisation", ("loading", "capacity")
    ),
}


def governed_run(name: str, config: dict[str, Any], execute: Callable[[], Any]) -> dict[str, Any]:
    definition = ALGORITHMS[name]
    started = time.perf_counter()
    result = execute()
    return {
        "algorithm": asdict(definition),
        "config_sha256": canonical_hash(config),
        "result_sha256": canonical_hash(result),
        "runtime_ms": round((time.perf_counter() - started) * 1000, 3),
        "result": result,
        "display_as_capacity": False,
    }
