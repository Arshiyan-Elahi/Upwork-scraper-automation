from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.models import Base
from app.models_intelligence import GenerationLog, PortfolioOutcomeBoost, ProposalPortfolioLink, WinningProposal  # noqa: F401
from app.models_profile import Profile  # noqa: F401
from app.models_portfolio import PortfolioItem  # noqa: F401
from app.models_settings import AppSettings, LLMCredential  # noqa: F401
from app.models_user import User  # noqa: F401
from app.models_user_state import UserJobState  # noqa: F401

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

        # NOTE: per-user job state (stage/outcome/submitted/fit_*) no longer lives
        # on the shared `jobs` table — it moved to `user_job_state`. Any legacy
        # columns on `jobs` are left in place (harmless) and migrated by backfill.

        wp_rows = conn.execute(text("PRAGMA table_info(winning_proposals)")).fetchall()
        wp_columns = {row[1] for row in wp_rows}
        if wp_columns and "source_job_id" not in wp_columns:
            conn.execute(text("ALTER TABLE winning_proposals ADD COLUMN source_job_id INTEGER"))

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

        # --- Step 2: per-user data isolation ----------------------------------
        # Add a nullable user_id to every per-user table (existing rows get NULL
        # and are claimed by the backfill). Guarded so a fresh DB — where these
        # columns already exist from create_all — is left untouched.
        _add_user_id_column(conn, "profiles")
        _add_user_id_column(conn, "portfolio_items")
        _add_user_id_column(conn, "winning_proposals")
        _add_user_id_column(conn, "app_settings")
        _add_user_id_column(conn, "llm_credentials")
        _add_user_id_column(conn, "generation_logs")
        _add_user_id_column(conn, "proposal_portfolio_links")
        _add_user_id_column(conn, "portfolio_outcome_boosts")

        # Replace the old GLOBAL-unique indexes with per-user composite uniques so
        # two users can independently configure the same provider / hire on the
        # same shared job.
        _replace_unique_index(
            conn,
            table="llm_credentials",
            drop=("ix_llm_credentials_provider", "uq_llm_credentials_provider"),
            create_name="uq_llm_credentials_user_provider",
            create_sql=(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_credentials_user_provider "
                "ON llm_credentials(user_id, provider)"
            ),
        )
        _replace_unique_index(
            conn,
            table="winning_proposals",
            drop=("uq_winning_proposals_source_job_id",),
            create_name="uq_winning_proposals_user_source_job_id",
            create_sql=(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_winning_proposals_user_source_job_id "
                "ON winning_proposals(user_id, source_job_id) WHERE source_job_id IS NOT NULL"
            ),
        )


def _add_user_id_column(conn, table: str) -> None:
    """Add a nullable user_id column to an existing table if it lacks one."""
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    columns = {row[1] for row in rows}
    if columns and "user_id" not in columns:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))


def _replace_unique_index(conn, *, table: str, drop: tuple[str, ...], create_name: str, create_sql: str) -> None:
    """Drop legacy unique indexes on a table and create the per-user composite one."""
    existing = {
        row[1] for row in conn.execute(text(f"PRAGMA index_list({table})")).fetchall()
    }
    for name in drop:
        if name in existing:
            conn.execute(text(f"DROP INDEX IF EXISTS {name}"))
    if create_name not in existing:
        conn.execute(text(create_sql))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
    backfill_unowned_data_to_first_user()


# Per-user columns that no longer belong on the shared `jobs` table — they moved
# to `user_job_state`. Used by both the backfill (to preserve values) and the
# table rebuild (to physically remove them from legacy DBs).
_LEGACY_JOB_STATE_COLUMNS = (
    "stage",
    "outcome",
    "submitted_proposal_text",
    "submitted_variant_label",
    "fit_score",
    "fit_recommendation",
    "fit_reasons",
    "fit_concerns",
    "fit_angle",
    "fit_scored_at",
)

# The objective columns the shared `jobs` table keeps (must match the Job model).
_SHARED_JOB_COLUMNS = (
    "id",
    "external_id",
    "title",
    "description",
    "budget",
    "budget_type",
    "skills",
    "job_url",
    "posted_date",
    "source",
    "raw_email_id",
    "client_rating",
    "client_spend",
    "client_country",
    "payment_verified",
    "created_at",
)


def backfill_unowned_data_to_first_user() -> None:
    """Assign all pre-existing (user_id IS NULL) per-user rows to the first user
    and strip legacy per-user columns off the shared `jobs` table.

    Safe + idempotent: only touches NULL rows, preserves legacy job state into
    user_job_state before any column is removed, and does the row-claiming nothing
    when no user exists yet. The first signup also calls this so legacy data is
    claimed by the initial account.
    """
    with SessionLocal() as db:
        first_user_id = db.execute(text("SELECT MIN(id) FROM users")).scalar()
        if first_user_id is not None:
            for table in (
                "profiles",
                "portfolio_items",
                "winning_proposals",
                "llm_credentials",
                "generation_logs",
                "proposal_portfolio_links",
                "portfolio_outcome_boosts",
            ):
                db.execute(
                    text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"),
                    {"uid": first_user_id},
                )

            # app_settings: claim the legacy global 'default' row and re-key it
            # per-user so it satisfies the unique(settings_key) constraint.
            db.execute(
                text(
                    "UPDATE app_settings SET user_id = :uid, settings_key = :skey "
                    "WHERE user_id IS NULL AND settings_key = 'default'"
                ),
                {"uid": first_user_id, "skey": f"user:{first_user_id}"},
            )
            db.execute(
                text("UPDATE app_settings SET user_id = :uid WHERE user_id IS NULL"),
                {"uid": first_user_id},
            )

            # Preserve any legacy per-user job state BEFORE we drop those columns.
            _backfill_job_state(db, first_user_id)
            db.commit()

    # Physically remove the legacy per-user columns from the shared jobs table so
    # inserts (e.g. the public webhook) succeed without a stage/fit. Runs after the
    # job-state values above are safely copied.
    _drop_legacy_job_state_columns(first_user_id)


def _drop_legacy_job_state_columns(first_user_id: int | None) -> None:
    """Rebuild `jobs` without the legacy per-user columns. Guarded + idempotent.

    SQLite's ALTER TABLE DROP COLUMN is limited across versions, so we rebuild the
    table with only the objective columns and copy the data over.
    """
    if not engine.url.get_backend_name().startswith("sqlite"):
        return

    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(jobs)")).fetchall()}
        legacy_present = [c for c in _LEGACY_JOB_STATE_COLUMNS if c in cols]
        if not legacy_present:
            return  # fresh DB or already migrated — nothing to do

        # Without an owner we cannot preserve per-user job state. If such state
        # exists, defer the rebuild until the first signup (which sets a user and
        # re-runs this) so nothing is lost.
        if first_user_id is None and _has_legacy_job_state(conn, legacy_present):
            return

        shared_cols = [c for c in _SHARED_JOB_COLUMNS if c in cols]
        col_list = ", ".join(shared_cols)

        conn.execute(
            text(
                "CREATE TABLE jobs_new ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "external_id VARCHAR(255), "
                "title VARCHAR(500) NOT NULL, "
                "description TEXT, "
                "budget VARCHAR(255), "
                "budget_type VARCHAR(50), "
                "skills JSON, "
                "job_url VARCHAR(2048), "
                "posted_date DATETIME, "
                "source VARCHAR(50) NOT NULL DEFAULT 'extension', "
                "raw_email_id VARCHAR(512), "
                "client_rating FLOAT, "
                "client_spend VARCHAR(100), "
                "client_country VARCHAR(100), "
                "payment_verified BOOLEAN, "
                "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )
        conn.execute(text(f"INSERT INTO jobs_new ({col_list}) SELECT {col_list} FROM jobs"))
        conn.execute(text("DROP TABLE jobs"))
        conn.execute(text("ALTER TABLE jobs_new RENAME TO jobs"))

        # Recreate the indexes/uniques the model defines on jobs.
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_job_url ON jobs(job_url)")
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_jobs_created_at ON jobs(created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_jobs_external_id ON jobs(external_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_jobs_raw_email_id ON jobs(raw_email_id)"))


def _has_legacy_job_state(conn, legacy_present: list[str]) -> bool:
    """True if any job still carries per-user state worth preserving."""
    conditions: list[str] = []
    if "stage" in legacy_present:
        conditions.append("(stage IS NOT NULL AND stage <> 'found')")
    if "outcome" in legacy_present:
        conditions.append("outcome IS NOT NULL")
    if "submitted_proposal_text" in legacy_present:
        conditions.append("submitted_proposal_text IS NOT NULL")
    if "fit_scored_at" in legacy_present:
        conditions.append("fit_scored_at IS NOT NULL")
    if not conditions:
        return False
    where = " OR ".join(conditions)
    return conn.execute(text(f"SELECT 1 FROM jobs WHERE {where} LIMIT 1")).first() is not None


def _backfill_job_state(db: Session, user_id: int) -> None:
    """Migrate legacy per-user job columns (if present on `jobs`) into user_job_state."""
    job_columns = {
        row[1] for row in db.execute(text("PRAGMA table_info(jobs)")).fetchall()
    }
    present = [f for f in _LEGACY_JOB_STATE_COLUMNS if f in job_columns]
    if not present:
        return

    select_cols = ", ".join(["id", *present])
    rows = db.execute(text(f"SELECT {select_cols} FROM jobs")).fetchall()
    for row in rows:
        data = dict(zip(["id", *present], row))
        job_id = data["id"]
        has_state = (
            (data.get("stage") not in (None, "found"))
            or data.get("outcome") is not None
            or data.get("submitted_proposal_text") is not None
            or data.get("fit_scored_at") is not None
        )
        if not has_state:
            continue
        exists = db.execute(
            text(
                "SELECT 1 FROM user_job_state WHERE user_id = :uid AND job_id = :jid"
            ),
            {"uid": user_id, "jid": job_id},
        ).first()
        if exists:
            continue
        db.execute(
            text(
                "INSERT INTO user_job_state "
                "(user_id, job_id, stage, outcome, submitted_proposal_text, "
                " submitted_variant_label, fit_score, fit_recommendation, "
                " fit_reasons, fit_concerns, fit_angle, fit_scored_at) "
                "VALUES (:uid, :jid, :stage, :outcome, :spt, :svl, :fs, :fr, "
                " :freasons, :fconcerns, :fangle, :fscored)"
            ),
            {
                "uid": user_id,
                "jid": job_id,
                "stage": data.get("stage") or "found",
                "outcome": data.get("outcome"),
                "spt": data.get("submitted_proposal_text"),
                "svl": data.get("submitted_variant_label"),
                "fs": data.get("fit_score"),
                "fr": data.get("fit_recommendation"),
                "freasons": data.get("fit_reasons"),
                "fconcerns": data.get("fit_concerns"),
                "fangle": data.get("fit_angle"),
                "fscored": data.get("fit_scored_at"),
            },
        )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
