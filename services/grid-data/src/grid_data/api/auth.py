from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request

from fastapi import Header, HTTPException, status

from grid_data.api.models import UserIdentity


def session_user(authorization: str | None = Header(default=None)) -> UserIdentity:
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

    # Read claims only AFTER Supabase has verified this bearer token. Never use an
    # unverified JWT decoder as authentication or trust user_metadata for roles.
    try:
        token = authorization.split(" ", 1)[1]
        if len(token) > 16_384:
            raise ValueError("Token too large")
        encoded = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if claims.get("sub") != payload["id"]:
            raise ValueError("Subject mismatch")
        token_role = claims["role"]
        if not isinstance(token_role, str):
            raise ValueError("Role missing")
    except (ValueError, KeyError, IndexError, TypeError) as error:
        raise HTTPException(401, "Invalid session claims") from error
    return UserIdentity(id=payload["id"], email=payload.get("email"),
        is_anonymous=payload.get("is_anonymous") is True, token_role=token_role)


def authenticated_user(authorization: str | None = Header(default=None)) -> UserIdentity:
    user = session_user(authorization)
    if user.is_anonymous or user.token_role == "gridpulse_public_visitor":
        raise HTTPException(403, "Anonymous sessions cannot access private analytics")
    return user


def anonymous_owner(owner_id) -> bool:
    """Recheck recovered public jobs against Auth, without creating an identity."""
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("Owner verification is not configured")
    request = urllib.request.Request(url + "/auth/v1/admin/users/" + str(owner_id),
        headers={"apikey": key, "authorization": "Bearer " + key})
    with urllib.request.urlopen(request, timeout=10) as response:
        raw = response.read(128_001)
    if len(raw) > 128_000:
        raise RuntimeError("Owner verification response exceeds budget")
    user = json.loads(raw)
    return user.get("id") == str(owner_id) and user.get("is_anonymous") is True
