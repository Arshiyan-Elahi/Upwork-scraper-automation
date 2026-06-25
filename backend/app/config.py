from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./freelance.db"

    encryption_key: str = ""

    gemini_api_key: str = ""
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    gemini_model: str = "gemini-2.0-flash"
    groq_model: str = "llama-3.3-70b-versatile"
    anthropic_model: str = "claude-sonnet-4-20250514"
    openai_model: str = "gpt-4o-mini"

    # Localhost dev origins, always allowed so local development keeps working.
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:5175,"
        "http://127.0.0.1:5175"
    )

    # Extra allowed origins for deployed frontends (comma-separated).
    # e.g. CORS_ALLOW_ORIGINS="http://45.11.231.77:3000,https://app.example.com"
    # These are added ON TOP OF the localhost defaults above — no IP is hardcoded.
    cors_allow_origins: str = ""

    webhook_secret: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        """Localhost defaults + any CORS_ALLOW_ORIGINS entries, deduped (order preserved)."""
        merged: list[str] = []
        for source in (self.cors_origins, self.cors_allow_origins):
            for origin in source.split(","):
                cleaned = origin.strip().rstrip("/")
                if cleaned and cleaned not in merged:
                    merged.append(cleaned)
        return merged


@lru_cache
def get_settings() -> Settings:
    return Settings()
