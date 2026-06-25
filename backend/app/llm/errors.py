class LLMError(Exception):
    """Base error for LLM provider failures."""


class LLMConfigurationError(LLMError):
    """Raised when a required API key or provider setting is missing."""
