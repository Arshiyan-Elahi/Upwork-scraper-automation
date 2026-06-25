"""Shared Upwork job URL helpers (used by webhook ingestion)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

_JOB_URL_RE = re.compile(
    r"https?://(?:www\.)?upwork\.com/(?:nx/)?jobs/(?:search/details/)?(~[a-zA-Z0-9]+)[^\s\"'<>]*",
    re.IGNORECASE,
)


def normalize_job_url(url: str) -> str:
    parsed = urlparse(url.split("?")[0].rstrip("/"))
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"


def extract_external_id(url: str | None) -> str | None:
    if not url:
        return None
    match = _JOB_URL_RE.search(url)
    if match:
        return match.group(1)
    tilde = re.search(r"(~[a-zA-Z0-9]+)", url)
    return tilde.group(1) if tilde else None
