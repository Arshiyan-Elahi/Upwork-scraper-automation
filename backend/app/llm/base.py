from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Contract for swappable LLM backends."""

    @abstractmethod
    def complete_structured(self, system: str, prompt: str, schema_hint: str) -> dict:
        """Return a parsed JSON object for analysis / extraction tasks."""

    @abstractmethod
    def complete_text(
        self,
        system: str,
        prompt: str,
        temperature: float = 0.7,
    ) -> str:
        """Return plain text for creative / generation tasks."""
