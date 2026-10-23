"""Copy existing CI credentials only to the approved free MILP service. No activation."""
import json
import os
import urllib.request

from check_milp_storage import NoRedirect

SERVICE = "srv-dbdqs1jrjlhs73833tng"
WORKSPACE = "tea-d95bm23tqb8s73elgd9g"


def main():
    token = os.environ["RENDER_API_KEY"]
    opener = urllib.request.build_opener(NoRedirect())

    def request(path, method="GET", payload=None):
        req = urllib.request.Request("https://api.render.com/v1" + path, method=method,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            data=json.dumps(payload).encode() if payload is not None else None)
        with opener.open(req, timeout=30) as response:
            return json.loads(response.read(1_000_000))

    service = request("/services/" + SERVICE)
    if (service.get("ownerId") != WORKSPACE or service.get("name") != "gridpulse-operations-milp"
            or service.get("serviceDetails", {}).get("plan") != "free"
            or service.get("repo") != "https://github.com/SinaDevCool/GridPulse-Fullb"):
        raise ValueError("Approved free runtime identity differs; no credentials copied")
    values = {key: os.environ[key] for key in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY")}
    if any(not value for value in values.values()):
        raise ValueError("Required existing credential is unavailable")
    for key, value in values.items():
        request(f"/services/{SERVICE}/env-vars/{key}", "PUT", {"value": value})
    print(json.dumps({"service_id": SERVICE, "plan": "free", "credential_keys_configured": sorted(values),
        "public_activation": False, "other_service_variables_replaced": False}))


if __name__ == "__main__":
    main()
