from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.models import Base
from app.models_intelligence import GenerationLog, PortfolioOutcomeBoost, ProposalPortfolioLink, WinningProposal  # noqa: F401
from app.models_profile import Profile  # noqa: F401
from app.models_portfolio import PortfolioItem  # noqa: F401
from app.models_settings import AppSettings, LLMCredential  # noqa: F401

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _migrate_sqlite() -> None:
    """Add columns to existing SQLite DBs without Alembic."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        gen_rows = conn.execute(text("PRAGMA table_info(generation_logs)")).fetchall()
        gen_columns = {row[1] for row in gen_rows}
        if "custom_instructions" not in gen_columns:
            conn.execute(
                text("ALTER TABLE generation_logs ADD COLUMN custom_instructions TEXT")
            )

        job_rows = conn.execute(text("PRAGMA table_info(jobs)")).fetchall()
        job_columns = {row[1] for row in job_rows}
        if "stage" not in job_columns:
            conn.execute(
                text("ALTER TABLE jobs ADD COLUMN stage VARCHAR(32) NOT NULL DEFAULT 'found'")
            )
        if "outcome" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN outcome VARCHAR(32)"))
        if "submitted_proposal_text" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN submitted_proposal_text TEXT"))
        if "submitted_variant_label" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN submitted_variant_label VARCHAR(255)"))
        if "fit_score" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN fit_score INTEGER"))
        if "fit_recommendation" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN fit_recommendation VARCHAR(16)"))
        if "fit_reasons" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN fit_reasons JSON"))
        if "fit_concerns" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN fit_concerns JSON"))
        if "fit_angle" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN fit_angle TEXT"))
        if "fit_scored_at" not in job_columns:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN fit_scored_at DATETIME"))

        wp_rows = conn.execute(text("PRAGMA table_info(winning_proposals)")).fetchall()
        wp_columns = {row[1] for row in wp_rows}
        if wp_columns and "source_job_id" not in wp_columns:
            conn.execute(text("ALTER TABLE winning_proposals ADD COLUMN source_job_id INTEGER"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_winning_proposals_source_job_id "
                    "ON winning_proposals(source_job_id) WHERE source_job_id IS NOT NULL"
                )
            )

        run_rows = conn.execute(text("PRAGMA table_info(ingestion_runs)")).fetchall()
        run_columns = {row[1] for row in run_rows}
        if run_columns:
            if "jobs_updated" not in run_columns:
                conn.execute(
                    text("ALTER TABLE ingestion_runs ADD COLUMN jobs_updated INTEGER NOT NULL DEFAULT 0")
                )
            if "run_type" not in run_columns:
                conn.execute(
                    text("ALTER TABLE ingestion_runs ADD COLUMN run_type VARCHAR(32) NOT NULL DEFAULT 'webhook'")
                )

        settings_rows = conn.execute(text("PRAGMA table_info(app_settings)")).fetchall()
        settings_columns = {row[1] for row in settings_rows}
        if settings_columns and "llm_generation_provider" not in settings_columns:
            conn.execute(text("ALTER TABLE app_settings ADD COLUMN llm_generation_provider VARCHAR(32)"))

        profile_rows = conn.execute(text("PRAGMA table_info(profiles)")).fetchall()
        profile_columns = {row[1] for row in profile_rows}
        if profile_columns:
            if "name" not in profile_columns:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN name VARCHAR(255)"))
            if "upwork_profile_url" not in profile_columns:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN upwork_profile_url VARCHAR(2048)"))
            if "behance_url" not in profile_columns:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN behance_url VARCHAR(2048)"))
            if "is_active" not in profile_columns:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 0"))

            if "profile_key" in profile_columns and "name" in profile_columns:
                conn.execute(
                    text(
                        "UPDATE profiles SET name = profile_key "
                        "WHERE name IS NULL OR TRIM(name) = ''"
                    )
                )
            conn.execute(
                text(
                    "UPDATE profiles SET name = 'Default Profile' "
                    "WHERE name IS NULL OR TRIM(name) = ''"
                )
            )
            # Legacy-only: the old 'profile_key' column does not exist on a fresh DB,
            # so only run this UPDATE when that column is actually present.
            if "profile_key" in profile_columns:
                conn.execute(
                    text(
                        "UPDATE profiles SET is_active = 1 "
                        "WHERE profile_key = 'default' AND is_active = 0"
                    )
                )
            conn.execute(
                text(
                    "UPDATE profiles SET is_active = 1 "
                    "WHERE id = (SELECT MIN(id) FROM profiles) "
                    "AND NOT EXISTS (SELECT 1 FROM profiles WHERE is_active = 1)"
                )
            )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
    _seed_app_settings()


def _seed_app_settings() -> None:
    from app.intelligence.proposal_rules import default_proposal_voice_rules_text
    from app.models_settings import DEFAULT_SETTINGS_KEY, AppSettings

    with SessionLocal() as db:
        existing = (
            db.query(AppSettings)
            .filter(AppSettings.settings_key == DEFAULT_SETTINGS_KEY)
            .first()
        )
        if existing is None:
            db.add(
                AppSettings(
                    settings_key=DEFAULT_SETTINGS_KEY,
                    proposal_voice_rules=default_proposal_voice_rules_text(),
                )
            )
            db.commit()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
