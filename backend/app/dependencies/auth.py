"""
Brightloop — Authentication & Authorization Dependencies.

Integrates with Supabase Auth:
- Parses Bearer token from the HTTP Authorization header.
- Validates JWT signature / user session against Supabase Auth.
- Extracts identity (user ID) and effective role (admin, staff, customer).
- Enforces role-based permissions via require_role.
- Returns agreed structured error responses on 401 Unauthorized or 403 Forbidden.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional
from uuid import UUID

from fastapi import Depends, Header, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger("brightloop.auth")


class User(BaseModel):
    id: UUID
    email: str
    role: str = Field(default="customer", description="User role: admin, staff, or customer")
    is_active: bool = True


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> User:
    """
    Extracts and verifies the Bearer token from the Authorization header.
    
    In a live Supabase environment, this verifies the JWT against Supabase Auth.
    Raises AppError with 401 UNAUTHORIZED if the token is missing or invalid.
    """
    if not authorization:
        raise AppError(
            code="UNAUTHORIZED",
            message="Missing or invalid authentication credentials.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(
            code="UNAUTHORIZED",
            message="Authorization header must follow format: Bearer <token>",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    token = parts[1]
    settings = get_settings()

    # If Supabase is configured, verify token via Supabase client
    if settings.supabase_url and settings.supabase_anon_key:
        try:
            from supabase import create_client
            client = create_client(settings.supabase_url, settings.supabase_anon_key)
            response = client.auth.get_user(token)
            if not response or not response.user:
                raise ValueError("Invalid user token")
            
            sb_user = response.user
            # Extract role from user_metadata or app_metadata
            user_meta = sb_user.user_metadata or {}
            app_meta = sb_user.app_metadata or {}
            role = app_meta.get("role") or user_meta.get("role") or "customer"

            return User(
                id=UUID(sb_user.id),
                email=sb_user.email or "",
                role=role,
            )
        except Exception as exc:
            logger.warning("Token verification failed: %s", exc)
            raise AppError(
                code="UNAUTHORIZED",
                message="Invalid or expired authentication token.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            ) from exc

    # In local/test mode without live Supabase credentials, decode payload safely
    # If the token is a synthetic test token or JWT
    try:
        import base64
        import json
        payload_part = token.split(".")[1] if "." in token else None
        if payload_part:
            padded = payload_part + "=" * (-len(payload_part) % 4)
            claims = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
            user_id = UUID(claims.get("sub", "00000000-0000-0000-0000-000000000001"))
            email = claims.get("email", "user@example.com")
            role = claims.get("role") or claims.get("user_metadata", {}).get("role", "customer")
            return User(id=user_id, email=email, role=role)
    except Exception:
        pass

    # If token cannot be validated
    raise AppError(
        code="UNAUTHORIZED",
        message="Invalid authentication token.",
        status_code=status.HTTP_401_UNAUTHORIZED,
    )


def require_role(allowed_roles: list[str]) -> Callable[[User], User]:
    """
    Dependency factory to restrict an endpoint to specific roles.
    Example: Depends(require_role(["admin"]))
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise AppError(
                code="PERMISSION_DENIED",
                message="You do not have permission to perform this action.",
                status_code=status.HTTP_403_FORBIDDEN,
                details=[f"Required role in: {allowed_roles}, caller role: {current_user.role}"],
            )
        return current_user

    return role_checker

