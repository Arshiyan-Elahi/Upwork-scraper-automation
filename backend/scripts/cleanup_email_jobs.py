#!/usr/bin/env python3
"""Delete stale email-sourced jobs that were never enriched by the Chrome extension."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import SessionLocal, init_db  # noqa: E402
from app.ingestion.cleanup import cleanup_stale_email_jobs  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove stale email-sourced jobs from the database.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print deleted vs kept counts without deleting rows",
    )
    args = parser.parse_args()

    init_db()
    with SessionLocal() as session:
        result = cleanup_stale_email_jobs(session, dry_run=args.dry_run)

    mode = " (dry run)" if result["dry_run"] else ""
    print(f"Email job cleanup{mode}: deleted={result['deleted']}, kept={result['kept']}")


if __name__ == "__main__":
    main()
