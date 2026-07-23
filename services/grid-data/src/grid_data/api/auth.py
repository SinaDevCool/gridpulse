from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from fastapi import Header, HTTPException, status

from grid_data.api.models import UserIdentity


def authenticated_user(authorization: str | None = Header(default=None)) -> UserIdentity:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required"
        )

    supabase_url = os.environ.get("SUPABASE_URL")
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not supabase_url or not publishable_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured",
        )

    request = urllib.request.Request(
        supabase_url.rstrip("/") + "/auth/v1/user",
        headers={
            "apikey": publishable_key,
            "authorization": authorization,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        if error.code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from error
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from error

    return UserIdentity(id=payload["id"], email=payload.get("email"))
