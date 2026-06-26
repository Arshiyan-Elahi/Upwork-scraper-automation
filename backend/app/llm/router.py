from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.llm.claude_client import ClaudeClient
from app.llm.credentials import get_generation_provider, resolve_provider_api_key
from app.llm.errors import LLMConfigurationError, LLMError
from app.llm.gemini_client import GeminiClient
from app.llm.groq_client import GroqClient
from app.llm.openai_client import OpenAIClient
from app.llm.providers import SUPPORTED_LLM_PROVIDERS

logger = logging.getLogger(__name__)


class LLMRouter:
    """
    Application façade for LLM calls.

    analyze()  → Gemini structured JSON (user-stored or .env key)
    generate() → selected generation provider text completion
    """

    def __init__(self, session: Session, user_id: int, settings: Settings | None = None) -> None:
        self._session = session
        self._user_id = user_id
        self._settings = settings or get_settings()
        self.last_provider_used: str | None = None

    def _client_for(self, provider: str, api_key: str):
        if provider == "gemini":
            return GeminiClient(api_key, settings=self._settings)
        if provider == "groq":
            return GroqClient(api_key, settings=self._settings)
        if provider == "claude":
            return ClaudeClient(api_key, settings=self._settings)
        if provider == "openai":
            return OpenAIClient(api_key, settings=self._settings)
        raise LLMConfigurationError(f"Unsupported LLM provider: {provider}")

    def analyze(self, system: str, prompt: str, schema_hint: str) -> dict:
        """Structured analysis — always Gemini."""
        api_key = resolve_provider_api_key(self._session, self._user_id, "gemini")
        if not api_key:
            raise LLMConfigurationError(
                "Gemini API key is not configured. Add it in Settings or set GEMINI_API_KEY in backend/.env."
            )
        client = self._client_for("gemini", api_key)
        result = client.complete_structured(system, prompt, schema_hint)
        self.last_provider_used = "gemini"
        logger.info("LLM analyze() served by gemini (%s)", self._settings.gemini_model)
        return result

    def generate(self, system: str, prompt: str, temperature: float = 0.7) -> str:
        """Creative text — uses the active generation provider from settings."""
        provider = get_generation_provider(self._session, self._user_id)
        if provider not in SUPPORTED_LLM_PROVIDERS:
            raise LLMConfigurationError(f"Unsupported generation provider: {provider}")

        api_key = resolve_provider_api_key(self._session, self._user_id, provider)
        if not api_key:
            raise LLMConfigurationError(
                f"No API key configured for generation provider {provider!r}. "
                "Add a key in Settings or configure the matching variable in backend/.env."
            )

        client = self._client_for(provider, api_key)
        try:
            text = client.complete_text(system, prompt, temperature)
        except LLMError:
            raise
        except Exception as exc:
            logger.exception("LLM generate() failed for provider %s", provider)
            raise LLMError(f"Generation failed for provider {provider}: {exc}") from exc

        self.last_provider_used = provider
        logger.info("LLM generate() served by %s", provider)
        return text


def get_llm_router(session: Session, user_id: int) -> LLMRouter:
    return LLMRouter(session, user_id)
