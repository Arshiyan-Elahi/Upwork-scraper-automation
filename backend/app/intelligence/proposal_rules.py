"""Proposal voice rules — defaults, DB storage, and file extraction."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from sqlalchemy.orm import Session

from app.models_settings import AppSettings

DEFAULT_PROPOSAL_VOICE_RULES: tuple[str, ...] = (
    "No generic intro — open with something specific to the job.",
    "No AI-sounding language or filler phrases.",
    "No fake claims or exaggerated promises.",
    'Never say "perfect fit" or "ideal candidate".',
    'Do not lead with "years of experience".',
    'Avoid "my process would include" — show the process, do not announce it.',
    "Include relevant portfolio links when they strengthen the pitch.",
    "End with one smart discovery question, not a generic close.",
    "Keep the proposal concise.",
)

ALLOWED_RULES_EXTENSIONS = {".md", ".txt", ".skills", ".pdf"}
REJECTED_IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".bmp",
    ".ico",
    ".tif",
    ".tiff",
    ".heic",
}

IMAGE_REJECTION_MESSAGE = (
    "Image files cannot be used for proposal rules. "
    "Upload a text-based file (.md, .txt, .skills) or a PDF with extractable text."
)


def default_proposal_voice_rules_text() -> str:
    return "\n".join(f"- {rule}" for rule in DEFAULT_PROPOSAL_VOICE_RULES)


def _settings_key_for(user_id: int) -> str:
    return f"user:{user_id}"


def _get_settings_row(session: Session, user_id: int) -> AppSettings | None:
    return session.query(AppSettings).filter(AppSettings.user_id == user_id).first()


def get_or_create_settings(session: Session, user_id: int) -> AppSettings:
    row = _get_settings_row(session, user_id)
    if row is None:
        row = AppSettings(
            user_id=user_id,
            settings_key=_settings_key_for(user_id),
            proposal_voice_rules=default_proposal_voice_rules_text(),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


def get_stored_proposal_voice_rules(session: Session, user_id: int) -> str | None:
    row = _get_settings_row(session, user_id)
    if row is None:
        return None
    text = (row.proposal_voice_rules or "").strip()
    return text or None


def load_proposal_voice_rules(session: Session, user_id: int) -> str:
    """Rules text for generation — stored value or hardcoded default if empty."""
    stored = get_stored_proposal_voice_rules(session, user_id)
    if stored:
        return stored
    return default_proposal_voice_rules_text()


def get_proposal_voice_rules_for_api(session: Session, user_id: int) -> str:
    """Rules text for GET — same as load (always returns usable rules)."""
    return load_proposal_voice_rules(session, user_id)


def save_proposal_voice_rules(session: Session, user_id: int, text: str) -> str:
    row = get_or_create_settings(session, user_id)
    cleaned = text.strip()
    row.proposal_voice_rules = cleaned or None
    session.commit()
    session.refresh(row)
    return load_proposal_voice_rules(session, user_id)


def resolve_voice_rules_block(voice_rules_text: str | None) -> str:
    """Format rules for the VOICE RULES prompt section."""
    text = (voice_rules_text or "").strip()
    if text:
        return text
    return default_proposal_voice_rules_text()


def _extension_for_filename(filename: str | None) -> str:
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def validate_rules_upload_filename(filename: str | None) -> None:
    ext = _extension_for_filename(filename)
    if ext in REJECTED_IMAGE_EXTENSIONS:
        raise ValueError(IMAGE_REJECTION_MESSAGE)
    if ext not in ALLOWED_RULES_EXTENSIONS:
        raise ValueError(
            "Unsupported file type. Upload .md, .txt, .skills, or .pdf for proposal rules."
        )


def extract_rules_text_from_bytes(data: bytes, filename: str | None) -> str:
    validate_rules_upload_filename(filename)
    ext = _extension_for_filename(filename)

    if ext == ".pdf":
        return _extract_pdf_text(data)

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(
            "Could not read file as UTF-8 text. Save as .txt or .md and try again."
        ) from exc

    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Uploaded file contains no readable text.")
    return cleaned


def _extract_pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ValueError("PDF support is not available on the server.") from exc

    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            parts.append(page_text.strip())

    text = "\n\n".join(parts).strip()
    if not text:
        raise ValueError(
            "Could not extract text from PDF. Use a text-based file (.md, .txt, .skills) instead."
        )
    return text
