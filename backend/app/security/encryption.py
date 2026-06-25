"""Fernet encryption for secrets at rest."""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

ENCRYPTION_KEY_HELP = (
    "ENCRYPTION_KEY is not configured. Generate one with: "
    'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" '
    "and add it to backend/.env."
)


class EncryptionKeyMissingError(Exception):
    """Raised when Fernet encryption is required but ENCRYPTION_KEY is unset."""


def encryption_configured() -> bool:
    return bool(get_settings().encryption_key.strip())


def _fernet() -> Fernet:
    raw = get_settings().encryption_key.strip()
    if not raw:
        raise EncryptionKeyMissingError(ENCRYPTION_KEY_HELP)
    return Fernet(raw.encode("utf-8"))


def encrypt_secret(plaintext: str) -> str:
    token = _fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    try:
        value = _fernet().decrypt(ciphertext.encode("utf-8"))
    except InvalidToken as exc:
        raise ValueError("Stored credential could not be decrypted.") from exc
    return value.decode("utf-8")
