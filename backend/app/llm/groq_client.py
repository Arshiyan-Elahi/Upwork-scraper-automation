from __future__ import annotations

import logging

from groq import Groq

from app.config import Settings, get_settings
from app.llm.base import LLMProvider
from app.llm.errors import LLMConfigurationError, LLMError

logger = logging.getLogger(__name__)


class GroqClient(LLMProvider):
    """Groq — creative text generation."""

    def __init__(
        self,
        api_key: str,
        *,
        settings: Settings | None = None,
        model: str | None = None,
    ) -> None:
        self._api_key = api_key.strip()
        self._settings = settings or get_settings()
        self._model_name = model or self._settings.groq_model
        self._client: Groq | None = None

    def _require_api_key(self) -> str:
        if not self._api_key:
            raise LLMConfigurationError(
                "Groq API key is not configured. Add it in Settings or set GROQ_API_KEY in backend/.env."
            )
        return self._api_key

    def _get_client(self) -> Groq:
        if self._client is None:
            self._client = Groq(api_key=self._require_api_key())
        return self._client

    def complete_structured(self, system: str, prompt: str, schema_hint: str) -> dict:
        raise LLMError("Groq client does not support structured JSON completion. Use Gemini via analyze().")

    def complete_text(
        self,
        system: str,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        try:
            response = self._get_client().chat.completions.create(
                model=self._model_name,
                messages=[
                    {"role": "system", "content": system.strip()},
                    {"role": "user", "content": prompt.strip()},
                ],
                temperature=max(0.0, min(1.0, temperature)),
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise LLMError("Groq returned an empty text response.")
            return text
        except LLMConfigurationError:
            raise
        except Exception as exc:
            logger.exception("Groq text completion failed")
            raise LLMError(f"Groq text completion failed: {exc}") from exc
