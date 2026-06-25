"""Chrome extension webhook ingestion."""

__all__ = ["run_webhook_ingestion"]


def __getattr__(name: str):
    if name == "run_webhook_ingestion":
        from app.ingestion.webhook import run_webhook_ingestion

        return run_webhook_ingestion
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
