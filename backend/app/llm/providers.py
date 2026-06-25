"""Supported LLM provider identifiers."""

from __future__ import annotations

SUPPORTED_LLM_PROVIDERS: tuple[str, ...] = ("gemini", "groq", "claude", "openai")

DEFAULT_GENERATION_PROVIDER = "groq"


def normalize_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized not in SUPPORTED_LLM_PROVIDERS:
        raise ValueError(
            f"Unsupported provider {provider!r}. "
            f"Use one of: {', '.join(SUPPORTED_LLM_PROVIDERS)}."
        )
    return normalized
