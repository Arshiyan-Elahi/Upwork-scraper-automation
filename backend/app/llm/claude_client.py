from __future__ import annotations

import logging

from anthropic import Anthropic

from app.config import Settings, get_settings
from app.llm.base import LLMProvider
from app.llm.errors import LLMConfigurationError, LLMError

logger = logging.getLogger(__name__)


class ClaudeClient(LLMProvider):
    """Anthropic Claude — text generation."""

    def __init__(
        self,
        api_key: str,
        *,
        settings: Settings | None = None,
        model: str | None = None,
    ) -> None:
        self._api_key = api_key.strip()
        self._settings = settings or get_settings()
        self._model_name = model or self._settings.anthropic_model
        self._client: Anthropic | None = None

    def _require_api_key(self) -> str:
        if not self._api_key:
            raise LLMConfigurationError(
                "Claude API key is not configured. Add it in Settings or set ANTHROPIC_API_KEY in backend/.env."
            )
        return self._api_key

    def _get_client(self) -> Anthropic:
        if self._client is None:
            self._client = Anthropic(api_key=self._require_api_key())
        return self._client

    def complete_structured(self, system: str, prompt: str, schema_hint: str) -> dict:
        raise LLMError("Claude client does not support structured JSON completion. Use Gemini via analyze().")

    def complete_text(
        self,
        system: str,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        try:
            response = self._get_client().messages.create(
                model=self._model_name,
                max_tokens=4096,
                system=system.strip(),
                messages=[{"role": "user", "content": prompt.strip()}],
                temperature=max(0.0, min(1.0, temperature)),
            )
            parts = [
                block.text
                for block in response.content
                if getattr(block, "type", None) == "text" and getattr(block, "text", None)
            ]
            text = "\n".join(parts).strip()
            if not text:
                raise LLMError("Claude returned an empty text response.")
            return text
        except LLMConfigurationError:
            raise
        except Exception as exc:
            logger.exception("Claude text completion failed")
            raise LLMError(f"Claude text completion failed: {exc}") from exc
