"""Enable only the qualified visitor hook and anonymous provider; CAPTCHA remains off.

No schema/billing changes. Restore previous auth settings if live signup verification fails.
Credentials and test session tokens stay in process memory and are never logged.
"""
import base64
import json
import os
import urllib.request

from apply_public_milp import verify
from apply_scoped_claim import Management

HOOK = "pg-functions://postgres/public/gridpulse_public_access_token"


def main():
    api = Management()
    verify(api)

    def request(url, method="GET", payload=None, headers=None):
        req = urllib.request.Request(url, method=method, headers=headers or {},
            data=json.dumps(payload).encode() if payload is not None else None)
        with api.opener.open(req, timeout=30) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("Auth metadata exceeds budget")
        return json.loads(raw)

    headers = {"Authorization": "Bearer " + api.token, "Content-Type": "application/json"}
    url = api.base + "/config/auth"
    before = request(url, headers=headers)
    if before.get("hook_custom_access_token_uri") not in (None, "", HOOK):
        raise ValueError("Another access-token hook is configured; refusing to replace it")
    if before.get("security_captcha_enabled"):
        raise ValueError("Existing CAPTCHA configuration will not be disabled by this script")
    if api.query("select count(*) as n from auth.users where is_anonymous is null", write=False)[0]["n"]:
        raise ValueError("Legacy identity flags require review before enabling the hook")
    keys = ("external_anonymous_users_enabled", "hook_custom_access_token_enabled", "hook_custom_access_token_uri")
    restore = {key: before.get(key) for key in keys}
    changed = False
    try:
        request(url, "PATCH", {"hook_custom_access_token_enabled": True,
            "hook_custom_access_token_uri": HOOK}, headers)
        changed = True
        hook = request(url, headers=headers)
        if not hook.get("hook_custom_access_token_enabled") or hook.get("hook_custom_access_token_uri") != HOOK:
            raise ValueError("Restricted hook was not enabled; signup remains blocked")
        request(url, "PATCH", {"external_anonymous_users_enabled": True}, headers)
        origin = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
        session = request(origin + "/auth/v1/signup", "POST", {"data": {}},
            {"apikey": key, "Content-Type": "application/json"})
        encoded = session["access_token"].split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if claims.get("role") != "gridpulse_public_visitor" or not session["user"].get("is_anonymous"):
            raise ValueError("Live signup did not issue a restricted visitor identity")
        rows = request(origin + "/rest/v1/analytics_jobs?select=id&limit=1", headers={
            "apikey": key, "Authorization": "Bearer " + session["access_token"]})
        if rows:
            raise ValueError("Fresh visitor unexpectedly reads existing jobs")
        print(json.dumps({"restricted_hook_enabled": True, "anonymous_signup_verified": True,
            "fresh_visitor_owner_read_verified": True, "captcha_enabled": False,
            "schema_changes": False, "runtime_activation": False}))
    except Exception:
        if changed:
            request(url, "PATCH", restore, headers)
        raise


if __name__ == "__main__":
    main()
