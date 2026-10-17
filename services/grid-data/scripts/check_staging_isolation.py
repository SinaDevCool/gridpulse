"""Explicitly configured, read-only real-JWT staging gate. Never creates accounts/data."""

import json
import os
import urllib.error
import urllib.parse
import urllib.request


def call(url, key, token, payload=None):
    request = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "authorization": f"Bearer {token}",
            "content-type": "application/json",
        },
        data=None if payload is None else json.dumps(payload).encode(),
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read(1048576))
    except urllib.error.HTTPError as error:
        return error.code, None  # Never print token-bearing requests or tenant response bodies.


def main() -> int:
    required = (
        "GRIDPULSE_STAGING_CONFIRMED",
        "STAGING_SUPABASE_URL",
        "STAGING_PUBLIC_KEY",
        "STAGING_API_URL",
        "STAGING_USER_A_JWT",
        "STAGING_USER_B_JWT",
        "STAGING_FACILITY_A",
        "STAGING_FACILITY_B",
        "STAGING_JOB_A",
        "STAGING_JOB_B",
        "STAGING_WINDOW_START",
        "STAGING_WINDOW_END",
    )
    if any(not os.environ.get(key) for key in required):
        print(
            json.dumps(
                {
                    "status": "blocked",
                    "reason": "Explicit staging configuration and two owner fixtures required",
                }
            )
        )
        return 2
    env = os.environ
    base, api = env["STAGING_SUPABASE_URL"].rstrip("/"), env["STAGING_API_URL"].rstrip("/")
    if (
        env["GRIDPULSE_STAGING_CONFIRMED"] != "yes"
        or any(urllib.parse.urlparse(url).scheme != "https" for url in (base, api))
        or urllib.parse.urlparse(base).hostname == "csdsquchhhwvvtleiyuy.supabase.co"
        or urllib.parse.urlparse(api).hostname == "gridpulseinsights.com"
        or env["STAGING_USER_A_JWT"] == env["STAGING_USER_B_JWT"]
        or env["STAGING_FACILITY_A"] == env["STAGING_FACILITY_B"]
    ):
        print(json.dumps({"status": "blocked", "reason": "Staging isolation safeguards failed"}))
        return 2
    checks = {}
    key = env["STAGING_PUBLIC_KEY"]
    identities = []
    for label, other in (("A", "B"), ("B", "A")):
        token = env[f"STAGING_USER_{label}_JWT"]
        status, user = call(base + "/auth/v1/user", key, token)
        checks[f"authenticated_{label}"] = (
            status == 200 and isinstance(user, dict) and bool(user.get("id"))
        )
        identities.append(user.get("id") if isinstance(user, dict) else None)
        status, own = call(api + "/v1/jobs/" + env[f"STAGING_JOB_{label}"], key, token)
        checks[f"own_job_{label}"] = (
            status == 200 and isinstance(own, dict) and own.get("owner_id") == identities[-1]
        )
        status, _ = call(api + "/v1/jobs/" + env[f"STAGING_JOB_{other}"], key, token)
        checks[f"cross_job_{label}"] = status == 404
        payload = {
            "p_facility_id": env[f"STAGING_FACILITY_{label}"],
            "p_start": env["STAGING_WINDOW_START"],
            "p_end": env["STAGING_WINDOW_END"],
        }
        status, own = call(base + "/rest/v1/rpc/operations_workspace_snapshot", key, token, payload)
        checks[f"own_workspace_{label}"] = (
            status == 200 and isinstance(own, dict) and bool(own.get("operations_facilities"))
        )
        status, denied = call(
            base + "/rest/v1/rpc/operations_workspace_snapshot",
            key,
            token,
            {**payload, "p_facility_id": env[f"STAGING_FACILITY_{other}"]},
        )
        checks[f"cross_workspace_{label}"] = status == 200 and denied is None
        status, _ = call(
            base + "/rest/v1/rpc/operations_worker_heartbeat",
            key,
            token,
            {
                "p_worker_id": "unauthorized-probe",
                "p_environment": "staging",
                "p_revision": "probe",
                "p_state": "idle",
            },
        )
        checks[f"service_rpc_denied_{label}"] = status in {401, 403}
    checks["distinct_accounts"] = all(identities) and len(set(identities)) == 2
    passed = all(checks.values())
    print(
        json.dumps(
            {
                "status": "pass" if passed else "fail",
                "checks": checks,
                "scope": "Real-JWT read isolation and service RPC denial only; write/revocation/concurrency drills remain separate",
            }
        )
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
