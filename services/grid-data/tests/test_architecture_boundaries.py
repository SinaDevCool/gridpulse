from __future__ import annotations

import ast
from pathlib import Path

import yaml


ROOT = Path(__file__).parents[3]
PACKAGE = ROOT / "services" / "grid-data" / "src" / "grid_data"


def _imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
        elif isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names)
    return imported


def test_grid_core_does_not_depend_on_capacity_engine_or_service_layers() -> None:
    violations: list[str] = []
    prohibited_roots = {"capacity_backtest", "fastapi", "supabase"}
    for path in PACKAGE.rglob("*.py"):
        relative = path.relative_to(PACKAGE)
        if relative.parts[0] == "api":
            continue
        for imported in _imports(path):
            if imported.split(".")[0] in prohibited_roots:
                violations.append(f"{relative}:{imported}")
    assert not violations


def test_deprecation_register_targets_exist_and_have_unique_replacements() -> None:
    registry = yaml.safe_load((ROOT / "config" / "analytics-deprecation-register.yaml").read_text())
    assert registry["schema_version"] == "gridpulse-analytics-deprecation-v1"
    replacements: dict[str, list[str]] = {}
    for identifier, item in registry["items"].items():
        target = (ROOT / item["path"]).resolve()
        status = item.get("status", "active")
        assert status in {"active", "retired"}, identifier
        if status == "active":
            assert target.exists(), identifier
        elif target.is_file() and item.get("symbols"):
            content = target.read_text(encoding="utf-8")
            assert all(symbol not in content for symbol in item["symbols"]), identifier
        elif target.is_dir():
            assert not tuple(target.glob("*.py")), identifier
        else:
            assert not target.exists(), identifier
        replacements.setdefault(item["replacement"], []).append(identifier)
        assert item["permitted_mode"]
        assert item["permitted_until"]
        if status == "retired":
            assert item["permitted_mode"] == "removed"
            assert item["completed_in"]
    assert all(replacements.values())


def test_audited_duplicate_calculators_are_retired() -> None:
    registry = yaml.safe_load((ROOT / "config" / "analytics-deprecation-register.yaml").read_text())
    active = [identifier for identifier, item in registry["items"].items() if item["status"] != "retired"]
    assert not active
