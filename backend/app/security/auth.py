"""JWT issuing/verification and the current-user FastAPI dependency."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models_user import User

logger = logging.getLogger(__name__)

# Process-lifetime fallback secret so local dev works without JWT_SECRET set.
# Tokens signed with this are invalidated on restart — set JWT_SECRET in prod.
_RUNTIME_FALLBACK_SECRET = secrets.token_urlsafe(48)
_warned_missing_secret = False

# auto_error=False so we can return a clean 401 (and not break CORS preflight).
_bearer_scheme = HTTPBearer(auto_error=False)


def _resolve_secret(settings: Settings) -> str:
    global _warned_missing_secret
    secret = (settings.jwt_secret or "").strip()
    if secret:
        return secret
    if not _warned_missing_secret:
        logger.warning(
            "JWT_SECRET is not set — using a temporary per-process secret. "
            "Sessions will not survive a restart. Set JWT_SECRET in the environment."
        )
        _warned_missing_secret = True
    return _RUNTIME_FALLBACK_SECRET


def create_access_token(user: User, *, settings: Settings | None = None) -> str:
    cfg = settings or get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=cfg.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, _resolve_secret(cfg), algorithm=cfg.jwt_algorithm)


def _decode_token(token: str, settings: Settings) -> dict:
    return jwt.decode(token, _resolve_secret(settings), algorithms=[settings.jwt_algorithm])


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Require a valid Bearer token; return the authenticated User or raise 401."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        raise unauthorized

    try:
        payload = _decode_token(credentials.credentials, settings)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.PyJWTError as exc:
        raise unauthorized from exc

    user_id = payload.get("sub")
    if user_id is None:
        raise unauthorized

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
    except (TypeError, ValueError) as exc:
        raise unauthorized from exc

    if user is None:
        raise unauthorized
    return user
