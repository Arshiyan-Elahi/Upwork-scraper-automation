"""Encrypted LLM API key storage and resolution."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.llm.providers import DEFAULT_GENERATION_PROVIDER, SUPPORTED_LLM_PROVIDERS, normalize_provider
from app.models_settings import AppSettings, LLMCredential
from app.security.encryption import decrypt_secret, encrypt_secret

# NOTE: LLM keys and the active generation provider are PER-USER. Every function
# here requires a user_id and scopes its queries to that user. The .env keys are
# the server operator's shared fallback (not another user's data) so they remain
# available to everyone when a user has not configured their own key.


def _settings_key_for(user_id: int) -> str:
    return f"user:{user_id}"


def _last4(api_key: str) -> str:
    key = api_key.strip()
    return key[-4:] if len(key) >= 4 else key


def _env_api_key(settings: Settings, provider: str) -> str:
    mapping = {
        "gemini": settings.gemini_api_key,
        "groq": settings.groq_api_key,
        "claude": settings.anthropic_api_key,
        "openai": settings.openai_api_key,
    }
    return (mapping.get(provider) or "").strip()


def _user_credential(session: Session, user_id: int, provider: str) -> LLMCredential | None:
    return (
        session.query(LLMCredential)
        .filter(LLMCredential.user_id == user_id, LLMCredential.provider == provider)
        .first()
    )


def _user_settings_row(session: Session, user_id: int) -> AppSettings | None:
    return session.query(AppSettings).filter(AppSettings.user_id == user_id).first()


def provider_has_key(session: Session, user_id: int, provider: str) -> bool:
    """True when this user has a stored key, or an .env fallback key exists."""
    provider = normalize_provider(provider)
    if _user_credential(session, user_id, provider) is not None:
        return True
    return bool(_env_api_key(get_settings(), provider))


def get_provider_status(session: Session, user_id: int) -> dict[str, dict[str, object]]:
    settings = get_settings()
    rows = {
        row.provider: row
        for row in session.query(LLMCredential).filter(LLMCredential.user_id == user_id).all()
    }
    status: dict[str, dict[str, object]] = {}
    for provider in SUPPORTED_LLM_PROVIDERS:
        row = rows.get(provider)
        env_configured = bool(_env_api_key(settings, provider))
        status[provider] = {
            "configured": row is not None or env_configured,
            "last4": row.last4 if row is not None else None,
        }
    return status


def get_generation_provider(session: Session, user_id: int) -> str:
    settings_row = _user_settings_row(session, user_id)
    if settings_row and settings_row.llm_generation_provider:
        return normalize_provider(settings_row.llm_generation_provider)

    settings = get_settings()
    if _env_api_key(settings, "groq"):
        return "groq"
    if _env_api_key(settings, "gemini"):
        return "gemini"
    for provider in SUPPORTED_LLM_PROVIDERS:
        if provider_has_key(session, user_id, provider):
            return provider
    return DEFAULT_GENERATION_PROVIDER


def set_generation_provider(session: Session, user_id: int, provider: str) -> str:
    provider = normalize_provider(provider)
    if not provider_has_key(session, user_id, provider):
        raise ValueError(f"No API key configured for provider {provider!r}.")

    settings_row = _user_settings_row(session, user_id)
    if settings_row is None:
        settings_row = AppSettings(user_id=user_id, settings_key=_settings_key_for(user_id))
        session.add(settings_row)

    settings_row.llm_generation_provider = provider
    session.commit()
    return provider


def save_provider_key(session: Session, user_id: int, provider: str, api_key: str) -> LLMCredential:
    provider = normalize_provider(provider)
    key = api_key.strip()
    if not key:
        raise ValueError("api_key must not be empty.")

    encrypted = encrypt_secret(key)
    last4 = _last4(key)
    now = datetime.now(timezone.utc)

    row = _user_credential(session, user_id, provider)
    if row is None:
        row = LLMCredential(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypted,
            last4=last4,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
    else:
        row.encrypted_key = encrypted
        row.last4 = last4
        row.updated_at = now

    session.commit()
    session.refresh(row)
    return row


def delete_provider_key(session: Session, user_id: int, provider: str) -> bool:
    provider = normalize_provider(provider)
    row = _user_credential(session, user_id, provider)
    if row is None:
        return False
    session.delete(row)

    settings_row = _user_settings_row(session, user_id)
    if settings_row and settings_row.llm_generation_provider == provider:
        settings_row.llm_generation_provider = None

    session.commit()
    return True


def resolve_provider_api_key(session: Session, user_id: int, provider: str) -> str | None:
    """
    Return this user's decrypted stored key, or the .env fallback key.

    Decryption happens in-memory at call time only.
    """
    provider = normalize_provider(provider)
    row = _user_credential(session, user_id, provider)
    if row is not None:
        return decrypt_secret(row.encrypted_key)

    env_key = _env_api_key(get_settings(), provider)
    return env_key or None
