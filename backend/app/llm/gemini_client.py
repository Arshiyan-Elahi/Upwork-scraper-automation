from __future__ import annotations

import json
import logging
import re
from typing import Any

import google.generativeai as genai

from app.config import Settings, get_settings
from app.llm.base import LLMProvider
from app.llm.errors import LLMConfigurationError, LLMError

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def _parse_json_response(raw: str) -> dict[str, Any]:
    text = raw.strip()
    text = _FENCE_RE.sub("", text).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Gemini returned invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise LLMError("Gemini structured response must be a JSON object.")
    return parsed


class GeminiClient(LLMProvider):
    """Google Gemini — structured analysis and text generation."""

    def __init__(
        self,
        api_key: str,
        *,
        settings: Settings | None = None,
        model: str | None = None,
    ) -> None:
        self._api_key = api_key.strip()
        self._settings = settings or get_settings()
        self._model_name = model or self._settings.gemini_model
        self._model: genai.GenerativeModel | None = None

    def _require_api_key(self) -> str:
        if not self._api_key:
            raise LLMConfigurationError(
                "Gemini API key is not configured. Add it in Settings or set GEMINI_API_KEY in backend/.env."
            )
        return self._api_key

    def _get_model(self) -> genai.GenerativeModel:
        if self._model is None:
            genai.configure(api_key=self._require_api_key())
            self._model = genai.GenerativeModel(self._model_name)
        return self._model

    def complete_structured(self, system: str, prompt: str, schema_hint: str) -> dict:
        instruction = (
            f"{system.strip()}\n\n"
            "You MUST respond with ONLY valid JSON — no markdown, no code fences, no commentary.\n"
            f"Expected JSON shape:\n{schema_hint.strip()}\n\n"
            f"Task:\n{prompt.strip()}"
        )
        try:
            response = self._get_model().generate_content(
                instruction,
                generation_config={"temperature": 0.2, "response_mime_type": "application/json"},
            )
            raw = (response.text or "").strip()
            if not raw:
                raise LLMError("Gemini returned an empty structured response.")
            return _parse_json_response(raw)
        except LLMConfigurationError:
            raise
        except Exception as exc:
            logger.exception("Gemini structured completion failed")
            raise LLMError(f"Gemini structured completion failed: {exc}") from exc

    def complete_text(
        self,
        system: str,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        instruction = f"{system.strip()}\n\n{prompt.strip()}"
        try:
            response = self._get_model().generate_content(
                instruction,
                generation_config={"temperature": max(0.0, min(1.0, temperature))},
            )
            text = (response.text or "").strip()
            if not text:
                raise LLMError("Gemini returned an empty text response.")
            return text
        except LLMConfigurationError:
            raise
        except Exception as exc:
            logger.exception("Gemini text completion failed")
            raise LLMError(f"Gemini text completion failed: {exc}") from exc
