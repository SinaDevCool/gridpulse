"""Read-only launch audit. Prints aggregate metadata only, never credentials or users."""
import json
import urllib.request

from apply_public_milp import verify
from apply_scoped_claim import Management


def main():
    api = Management()
    verify(api)
    request = urllib.request.Request(api.base + "/config/auth", headers={"Authorization": "Bearer " + api.token})
    with api.opener.open(request, timeout=25) as response:
        config = json.loads(response.read(2_000_000))
    identity = api.query("""select count(*) filter(where is_anonymous is null) as null_identity_flags,
      count(*) filter(where is_anonymous=true) as anonymous_identities from auth.users""", write=False)
    print(json.dumps({"auth": {key: config.get(key) for key in (
        "external_anonymous_users_enabled", "security_captcha_enabled", "rate_limit_anonymous_users",
        "hook_custom_access_token_enabled", "hook_custom_access_token_uri")},
        "identity_counts": identity, "public_boundary_verified": True, "changes_made": False}))


if __name__ == "__main__":
    main()
