"""Read-only production storage preflight. Never invokes a database RPC.

Discover the required transport shape from the existing store implementation,
not a second handwritten database schema. Metadata availability is necessary,
but does not prove RLS, transactional correctness or worker recovery.
"""
from __future__ import annotations

import ast
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Storage preflight does not follow redirects")


def store_contract(source: str) -> tuple[list[str], dict[str, list[str]]]:
    tree = ast.parse(source)
    store = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "SupabaseJobStore")
    row = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_job_row")
    returned = next(n.value for n in row.body if isinstance(n, ast.Return))
    if not isinstance(returned, ast.Dict):
        raise ValueError("Store row contract is not an explicit dictionary")
    columns = sorted(k.value for k in returned.keys if isinstance(k, ast.Constant) and isinstance(k.value, str))
    functions: dict[str, list[str]] = {}
    for call in ast.walk(store):
        if not isinstance(call, ast.Call) or len(call.args) < 3:
            continue
        method, path, payload = call.args[:3]
        if not (isinstance(method, ast.Constant) and method.value == "POST"
                and isinstance(path, ast.Constant) and isinstance(path.value, str)
                and path.value.startswith("/rpc/")):
            continue
        if not isinstance(payload, ast.Dict):
            raise ValueError("RPC contract is not an explicit dictionary")
        arguments = {k.value for k in payload.keys if isinstance(k, ast.Constant)}
        functions[path.value] = sorted(set(functions.get(path.value, [])) | arguments)
    if not columns or not functions:
        raise ValueError("Existing job-store contract could not be discovered")
    return columns, functions


def inspect_metadata(document: dict, columns: list[str], functions: dict[str, list[str]]) -> list[str]:
    issues: list[str] = []
    paths = document.get("paths", {})
    definitions = document.get("definitions", {})
    properties = definitions.get("analytics_jobs", {}).get("properties", {})
    missing = sorted(set(columns) - set(properties))
    if missing:
        issues.append("Missing analytics_jobs metadata columns: " + ", ".join(missing))
    if "get" not in paths.get("/analytics_jobs", {}):
        issues.append("analytics_jobs is not exposed to the configured service credential")
    for path, arguments in functions.items():
        operation = paths.get(path, {}).get("post")
        if not operation:
            issues.append("Missing service RPC: " + path.removeprefix("/rpc/"))
            continue
        bodies = [p.get("schema", {}) for p in operation.get("parameters", []) if p.get("in") == "body"]
        available: set[str] = set()
        for body in bodies:
            if "$ref" in body:
                body = definitions.get(body["$ref"].removeprefix("#/definitions/"), {})
            available.update(body.get("properties", {}))
        absent = sorted(set(arguments) - available)
        if absent:
            issues.append("RPC parameter metadata mismatch: " + path.removeprefix("/rpc/") + ": " + ", ".join(absent))
    return issues


def read_json(base: str, key: str, path: str, accept: str, limit: int = 8_000_000):
    # Only this function performs network I/O. The HTTP method cannot be supplied
    # by the caller; no RPC endpoint is ever requested, even via GET.
    if path != "/" and not path.startswith("/analytics_jobs?select="):
        raise ValueError("Preflight permits metadata and zero-row reads only")
    if path != "/" and not path.endswith("&limit=0"):
        raise ValueError("Preflight must not read customer job rows")
    request = urllib.request.Request(base + path, method="GET", headers={
        "apikey": key, "Authorization": "Bearer " + key, "Accept": accept,
    })
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=25) as response:
        raw = response.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("Metadata response exceeds the preflight size limit")
    return json.loads(raw)


def main() -> int:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
        print("BLOCKED: valid production Supabase HTTPS project origin is required")
        return 1
    if not key:
        print("BLOCKED: SUPABASE_SERVICE_ROLE_KEY is not configured in repository Actions secrets")
        return 1
    root = Path(__file__).resolve().parent.parent
    source = root / "services/grid-data/src/grid_data/api/store.py"
    columns, functions = store_contract(source.read_text(encoding="utf-8"))
    try:
        metadata = read_json(url + "/rest/v1", key, "/", "application/openapi+json")
        issues = inspect_metadata(metadata, columns, functions)
        # This requests no job rows, even when the credential bypasses RLS.
        rows = read_json(url + "/rest/v1", key,
                         "/analytics_jobs?select=" + ",".join(columns) + "&limit=0", "application/json")
        if rows != []:
            issues.append("Zero-row table probe returned an unexpected response")
    except urllib.error.HTTPError as error:
        # Never print response bodies, headers, URLs, tokens or raw exceptions.
        print(f"BLOCKED: read-only storage probe returned HTTP {error.code}")
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        print("BLOCKED: storage metadata unavailable or not in the expected format")
        return 1
    print(json.dumps({"read_only": True, "job_rows_read": 0,
                      "required_columns": len(columns), "required_rpcs": len(functions),
                      "metadata_compatible": not issues, "issues": issues,
                      "activation_performed": False,
                      "not_verified": ["RLS and cross-owner isolation", "RPC implementation and constraints",
                                       "worker liveness and restart recovery", "production runtime credentials"]}, indent=2))
    return int(bool(issues))


if __name__ == "__main__":
    sys.exit(main())
