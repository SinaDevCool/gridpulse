"""One real synthetic solve through the hosted public API. Tokens never leave memory."""
import json
import os
import time
import urllib.request
from pathlib import Path

from check_milp_storage import NoRedirect

origin = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
service = "https://gridpulse-operations-milp.onrender.com"
opener = urllib.request.build_opener(NoRedirect())


def request(url, headers=None, payload=None):
    req = urllib.request.Request(url, headers=headers or {}, method="POST" if payload is not None else "GET",
        data=json.dumps(payload).encode() if payload is not None else None)
    with opener.open(req, timeout=120) as response:
        raw = response.read(4_000_001)
    if len(raw) > 4_000_000:
        raise ValueError("Response exceeds bounded synthetic result budget")
    return json.loads(raw)


health = request(service + "/healthz")
assert health["enabled"] and health["worker_alive"] and not health["physical_dispatch_authorized"]
session = request(origin + "/auth/v1/signup", {"apikey": key, "Content-Type": "application/json"}, {"data": {}})
headers = {"Authorization": "Bearer " + session["access_token"], "Content-Type": "application/json"}
payload = json.loads(Path("browser-milp-request.json").read_text())
accepted = request(service + "/v1/jobs/facility-plan", headers, payload)
deadline = time.monotonic() + 180
while time.monotonic() < deadline:
    job = request(service + "/v1/jobs/" + accepted["job_id"], headers)
    if job["status"] in {"succeeded", "failed", "cancelled"}:
        break
    time.sleep(3)
assert job["status"] == "succeeded", job.get("error", job["status"])
result = job["result_payload"]["result"]
assert result["solver"] == "scipy-highs-milp"
assert result["status"] in {"optimal", "feasible_not_proven_optimal"}
assert result["assessment"]["feasible"] and not result["diagnostics"]
assert not job["result_payload"]["automatic_live_dispatch_authorized"]
Path("browser-milp-job.json").write_text(json.dumps(job))
print(json.dumps({"real_hosted_milp": True, "job_id": job["id"], "solver_status": result["status"],
    "physical_replay": True, "intervals": len(result["intervals"])}))
