from pathlib import Path

import pytest

from grid_data.graph.cgmes import parse_cgmes_package
from grid_data.graph.cgmes_projection import project_cgmes, validate_cgmes_round_trip
from grid_data.graph.topology_state import TopologyState, apply_topology_state, topology_diff
from grid_data.graph.weights import WeightInputs, topology_weight


def _write_profiles(root: Path) -> list[Path]:
    docs = {
        "model_EQ.xml": [
            ("BaseVoltage", "bv", ""),
            ("Substation", "s", ""),
            ("ACLineSegment", "line", "<c:ACLineSegment.BaseVoltage rdf:resource='#bv'/>"),
        ],
        "model_SSH.xml": [
            (
                "Breaker",
                "sw",
                "<c:Switch.open>false</c:Switch.open><c:Switch.ConductingEquipment rdf:resource='#line'/>",
            )
        ],
        "model_TP.xml": [
            ("TopologicalNode", "tn", "<c:TopologicalNode.BaseVoltage rdf:resource='#bv'/>")
        ],
        "model_SV.xml": [("SvVoltage", "sv", "<c:SvVoltage.TopologicalNode rdf:resource='#tn'/>")],
    }
    paths = []
    for name, rows in docs.items():
        body = "".join(
            f"<c:{kind} rdf:ID='{key}'>{children}</c:{kind}>" for kind, key, children in rows
        )
        path = root / name
        path.write_text(
            f"<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:c='urn:cgmes'>{body}</rdf:RDF>"
        )
        paths.append(path)
    return paths


def test_cgmes_profiles_projection_and_round_trip(tmp_path: Path):
    package = parse_cgmes_package(_write_profiles(tmp_path), model_id="pilot", version="2026-08-08")
    projection = project_cgmes(package)
    assert package.profiles == ("EQ", "SSH", "SV", "TP")
    assert validate_cgmes_round_trip(package, projection)["valid"] is True
    assert projection.safety["display_as_capacity"] is False


def test_cgmes_rejects_incomplete_package(tmp_path: Path):
    paths = _write_profiles(tmp_path)
    with pytest.raises(ValueError, match="missing required profiles"):
        parse_cgmes_package(paths[:1], model_id="pilot", version="v1")


def test_topology_state_is_immutable_and_diffable(tmp_path: Path):
    base = project_cgmes(
        parse_cgmes_package(_write_profiles(tmp_path), model_id="pilot", version="v1")
    )
    state = TopologyState("outage-line", {"sw": False}, ("line",), "planned outage")
    changed = apply_topology_state(base, state)
    assert changed.model_version.endswith("+outage-line")
    assert topology_diff(base, changed)["removed_edges"]
    assert base.projection_sha256 != changed.projection_sha256


def test_weights_are_decomposable_and_not_capacity():
    result = topology_weight(WeightInputs(10, 1, 0.2, 0.3, True, False, True))
    assert result["total"] == pytest.approx(sum(result["components"].values()))
    assert "available capacity" in result["prohibited_interpretations"]
