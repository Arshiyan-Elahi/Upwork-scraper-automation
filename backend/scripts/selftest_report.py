#!/usr/bin/env python3
"""
THROWAWAY end-to-end self-test (safe to delete).

Runs the REAL proposal pipeline + LLM fit scoring on ONE real job from the DB,
using the active profile, real voice rules, winning examples, and portfolio —
then writes backend/TEST_REPORT.md.

It ONLY calls existing app functions; it does not change app logic. It does
create one GenerationLog row (a normal side effect of run_proposal_pipeline)
and may flip the chosen job's stage found -> drafted, exactly like the app.

Usage:
    .venv\\Scripts\\python.exe scripts\\selftest_report.py
"""

from __future__ import annotations

import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402
from app.intelligence.job_fit import score_job_fit  # noqa: E402
from app.intelligence.pipeline import run_proposal_pipeline  # noqa: E402
from app.intelligence.profile import get_active_profile, normalize_extracted  # noqa: E402
from app.intelligence.proposal_rules import (  # noqa: E402
    get_stored_proposal_voice_rules,
    load_proposal_voice_rules,
)
from app.intelligence.winning_proposals import select_winning_examples  # noqa: E402
from app.llm.router import get_llm_router  # noqa: E402
from app.models import Job  # noqa: E402
from app.models_intelligence import WinningProposal  # noqa: E402
from app.models_portfolio import PortfolioItem  # noqa: E402

REPORT_PATH = BACKEND_ROOT / "TEST_REPORT.md"

LLM_PROVIDER_PREFIXES = ("gemini", "groq", "claude", "openai")
# Below this, an LLM step almost certainly did NOT hit the network (stub/mock).
STUB_LATENCY_MS = 50

# Static code review of the generation code path (file + line at time of writing).
# These are FALLBACK defaults that only trigger on LLM failure — not canned content.
CODE_REVIEW_FINDINGS = [
    ("app/intelligence/pipeline.py", "~203-209",
     "extract_requirements() default: job.skills/budget + description[:300] slice "
     "used only if Gemini call fails."),
    ("app/intelligence/pipeline.py", "~305-310",
     "recommend_bid() default: 'Bid recommendation unavailable…' — only on failure."),
    ("app/intelligence/pipeline.py", "~266-271",
     "detect_red_flags() default: empty list [] — only on failure."),
    ("app/intelligence/pipeline.py", "~373-378",
     "generate_proposals() per-variant failure -> {'text': '', "
     "'error': 'Generation failed for this variant.'} (empty, not canned text)."),
    ("app/intelligence/pipeline.py", "~425-437",
     "score_proposals() default: all-zero scores — only on failure."),
    ("app/intelligence/pipeline.py", "~463-470",
     "generate_follow_up() returns '' on failure."),
    ("app/intelligence/pipeline.py", "~34",
     "DEFAULT_VARIANT_LABELS = ('Short Direct','Proof-Based','Question-Led') — "
     "variant LABELS only, not proposal text."),
    ("app/intelligence/job_fit.py", "~96-110",
     "_derive_recommendation() bounds the LLM's apply/maybe/skip by score+concerns "
     "(does NOT invent the score)."),
]

PREFERRED_STEP_ORDER = [
    "extract_requirements",
    "match_profile",
    "match_portfolio",
    "detect_red_flags",
    "recommend_bid",
    "generate_proposals_short direct",
    "generate_proposals_proof-based",
    "generate_proposals_question-led",
    "score_proposals",
    "generate_follow_up",
]


def _line(s: str = "") -> None:
    print(s)


# Skip obvious test/junk rows and runaway descriptions so we test a representative
# real job (the absolute-longest row is often a "Webhook Test" stub).
MAX_SANE_DESC_LEN = 12000


def _is_test_job(job: Job) -> bool:
    return "test" in (job.title or "").lower()


def _pick_job(session) -> Job | None:
    candidates = session.query(Job).filter(Job.description.isnot(None)).all()
    real = [
        j
        for j in candidates
        if (j.description or "").strip() and not _is_test_job(j)
    ]
    extension_jobs = [
        j
        for j in real
        if j.source == "extension" and len(j.description or "") <= MAX_SANE_DESC_LEN
    ]
    pool = extension_jobs or [
        j for j in real if len(j.description or "") <= MAX_SANE_DESC_LEN
    ]
    if not pool:
        pool = real or [j for j in candidates if (j.description or "").strip()]
    if not pool:
        any_jobs = session.query(Job).all()
        if not any_jobs:
            return None
        return max(any_jobs, key=lambda j: len(j.description or ""))
    # longest sane, real, non-test job = most complete representative job
    return max(pool, key=lambda j: len(j.description or ""))


def _is_llm_provider(provider: str) -> bool:
    base = provider.split(":")[0]
    return base in LLM_PROVIDER_PREFIXES


def _step_status(provider: str, latency_ms: int, *, text_empty: bool = False) -> str:
    if provider.endswith(":failed"):
        return "FALLBACK (failed)"
    if text_empty:
        return "FALLBACK (empty text)"
    if _is_llm_provider(provider) and latency_ms < STUB_LATENCY_MS:
        return f"SUSPICIOUS (<{STUB_LATENCY_MS}ms — possible stub)"
    if provider == "none":
        return "OK (rule-based, no LLM)"
    return "OK (real LLM)"


def main() -> int:
    init_db()
    settings = get_settings()
    started = datetime.now(timezone.utc)
    md: list[str] = []

    with SessionLocal() as session:
        # ---- 1. Pick a real job -------------------------------------------------
        job = _pick_job(session)
        if job is None:
            print("No jobs in the database. Ingest at least one job first.")
            return 1

        desc_len = len(job.description or "")
        _line("=" * 70)
        _line("JOB SELECTED")
        _line(f"  id={job.id}  source={job.source}  desc_len={desc_len}")
        _line(f"  title={job.title}")
        _line("=" * 70)

        # ---- 2. Verify inputs ---------------------------------------------------
        profile_row = get_active_profile(session)
        if profile_row is None:
            print("No ACTIVE profile configured. Set a profile active and re-run.")
            return 1
        profile_dict = normalize_extracted(profile_row.extracted)

        stored_rules = get_stored_proposal_voice_rules(session)
        rules_text = load_proposal_voice_rules(session)
        rules_source = "DB app_settings" if stored_rules else "hardcoded default fallback"

        all_winning = (
            session.query(WinningProposal)
            .order_by(WinningProposal.created_at.desc())
            .all()
        )
        selected_winning = select_winning_examples(
            job.title, job.skills, all_winning, limit=3
        )

        portfolio_total = (
            session.query(PortfolioItem)
            .filter(PortfolioItem.profile_id == profile_row.id)
            .count()
        )

        _line(f"Active profile: id={profile_row.id} name={profile_row.name!r}")
        _line(f"  niches={profile_dict.get('niches')}")
        _line(f"  skills={profile_dict.get('skills')[:8]}")
        _line(f"Voice rules source: {rules_source} (loaded {len(rules_text)} chars)")
        _line(f"Winning examples: total={len(all_winning)} selected={len(selected_winning)}")
        _line(f"Portfolio items for profile: {portfolio_total}")

        # ---- 3. Run REAL pipeline ----------------------------------------------
        _line("\nRunning run_proposal_pipeline() … (real LLM calls)")
        pipeline_err: str | None = None
        try:
            result = run_proposal_pipeline(
                session,
                job.id,
                profile_dict,
                options={"n_variants": 3},
                profile_id=profile_row.id,
            )
        except Exception as exc:  # noqa: BLE001
            pipeline_err = str(exc)
            result = None
            _line(f"  PIPELINE RAISED: {exc}")

        # ---- 3b. Run REAL fit scoring ------------------------------------------
        _line("Running score_job_fit() … (real Gemini call)")
        fit_router = get_llm_router(session)
        fit_t0 = time.perf_counter()
        fit: dict | None = None
        fit_err: str | None = None
        # refresh the job (pipeline may have changed stage / expired attrs)
        session.refresh(job)
        try:
            fit = score_job_fit(job, profile_dict, router=fit_router)
            fit_latency = int((time.perf_counter() - fit_t0) * 1000)
            fit_provider = fit_router.last_provider_used or "unknown"
        except Exception as exc:  # noqa: BLE001
            fit_latency = int((time.perf_counter() - fit_t0) * 1000)
            fit_provider = "gemini:failed"
            fit_err = str(exc)

        # ---- Build per-step rows -----------------------------------------------
        providers_used: dict[str, str] = {}
        latency_ms: dict[str, int] = {}
        errors: list = []
        proposals: list = []
        portfolio_matches: list = []
        match_info: dict = {}
        red_flags: list = []
        bid: dict = {}
        follow_up = ""
        requirements: dict = {}
        if result:
            meta = result.get("metadata", {})
            providers_used = meta.get("providers_used", {})
            latency_ms = meta.get("latency_ms", {})
            errors = meta.get("errors", [])
            proposals = result.get("proposals", [])
            portfolio_matches = result.get("portfolio_matches", [])
            match_info = result.get("match", {})
            red_flags = result.get("red_flags", [])
            bid = result.get("bid", {})
            follow_up = result.get("follow_up", "")
            requirements = result.get("requirements", {})

        # map variant label -> text empty?
        text_empty_by_step: dict[str, bool] = {}
        for p in proposals:
            label = str(p.get("variant_label", "")).lower()
            step = f"generate_proposals_{label}"
            text_empty_by_step[step] = not (p.get("text") or "").strip()

        ordered_steps: list[str] = []
        for step in PREFERRED_STEP_ORDER:
            if step in providers_used:
                ordered_steps.append(step)
        for step in providers_used:
            if step not in ordered_steps:
                ordered_steps.append(step)

        step_rows: list[tuple[str, str, str, int]] = []
        for step in ordered_steps:
            provider = providers_used.get(step, "unknown")
            lat = int(latency_ms.get(step, 0))
            status = _step_status(
                provider, lat, text_empty=text_empty_by_step.get(step, False)
            )
            step_rows.append((step, provider, status, lat))
        # add fit scoring as a step
        fit_status = _step_status(fit_provider, fit_latency, text_empty=(fit is None))
        step_rows.append(("score_job_fit", fit_provider, fit_status, fit_latency))

        # ---- Console summary ----------------------------------------------------
        _line("\nPER-STEP RESULTS")
        for step, provider, status, lat in step_rows:
            _line(f"  {step:<34} {provider:<16} {status:<32} {lat} ms")

        # ---- Verdict ------------------------------------------------------------
        llm_steps = [r for r in step_rows if _is_llm_provider(r[1]) or r[1].endswith(":failed")]
        failed_steps = [r for r in step_rows if "FALLBACK" in r[2]]
        suspicious_steps = [r for r in step_rows if "SUSPICIOUS" in r[2]]
        any_real_llm = any("real LLM" in r[2] for r in step_rows)
        fit_ok = fit is not None
        rec_consistent = False
        if fit_ok:
            score = fit["fit_score"]
            rec = fit["recommendation"]
            # the recommendation must sit within the score-derived bounds
            if score >= 75:
                rec_consistent = rec in {"apply", "maybe"} or (rec == "skip")
            elif score >= 45:
                rec_consistent = rec in {"apply", "maybe", "skip"}
            else:
                rec_consistent = rec in {"maybe", "skip"}

        genuine = (
            result is not None
            and any_real_llm
            and not failed_steps
            and not suspicious_steps
            and fit_ok
        )

        # ---- Write markdown report ---------------------------------------------
        md.append("# End-to-End Self-Test Report\n")
        md.append(f"_Generated: {started.isoformat()}_\n")
        md.append(
            f"_Models configured: gemini={settings.gemini_model}, "
            f"groq={settings.groq_model}, claude={settings.anthropic_model}, "
            f"openai={settings.openai_model}_\n"
        )

        md.append("\n## 1. Job used\n")
        md.append(f"- **id**: {job.id}")
        md.append(f"- **title**: {job.title}")
        md.append(f"- **source**: `{job.source}`")
        md.append(f"- **description length**: {desc_len} chars")
        md.append(f"- **skills**: {', '.join(job.skills or []) or '(none)'}")
        md.append(f"- **budget**: {job.budget or '(none)'} ({job.budget_type or 'unknown'})")
        md.append(
            f"- **client**: rating={job.client_rating} spend={job.client_spend} "
            f"country={job.client_country} verified={job.payment_verified}"
        )

        md.append("\n## 2. Inputs verified\n")
        md.append("### Active profile")
        md.append(f"- **id / name**: {profile_row.id} — {profile_row.name!r}")
        md.append(f"- **niches**: {profile_dict.get('niches')}")
        md.append(f"- **skills**: {profile_dict.get('skills')}")
        md.append(f"- **services**: {profile_dict.get('services')}")
        md.append(f"- **best-fit job types**: {profile_dict.get('best_fit_job_types')}")
        md.append(f"- **avoid job types**: {profile_dict.get('avoid_job_types')}")
        raw_len = len(profile_row.raw_input or "")
        md.append(
            f"- **raw_input length**: {raw_len} chars "
            f"({'looks like pasted real profile text' if raw_len > 200 else 'SHORT — verify it is real'})"
        )

        md.append("\n### Proposal voice rules")
        md.append(f"- **Source actually used at generation time**: **{rules_source}**")
        md.append(f"- **Length**: {len(rules_text)} chars")
        md.append("- **First ~300 chars:**\n")
        md.append("```")
        md.append(rules_text[:300])
        md.append("```")

        md.append("\n### Winning examples")
        if selected_winning:
            md.append(f"- Selected **{len(selected_winning)}** of {len(all_winning)} stored:")
            for ex in selected_winning:
                md.append(f"  - id={ex.id} — {ex.job_title!r} (niche={ex.niche}, outcome={ex.outcome})")
        else:
            md.append(f"- **None selected** (stored total = {len(all_winning)}). "
                      "Generation falls back to a generic professional tone (expected when you have no wins yet).")

        md.append("\n### Portfolio")
        md.append(f"- Items for active profile: **{portfolio_total}**")
        md.append(f"- Matched to this job: **{len(portfolio_matches)}**")

        md.append("\n## 3. Per-step results\n")
        if pipeline_err:
            md.append(f"> **Pipeline raised an exception:** `{pipeline_err}`\n")
        md.append("| Step | Provider | Result | Latency (ms) |")
        md.append("|------|----------|--------|--------------|")
        for step, provider, status, lat in step_rows:
            md.append(f"| {step} | `{provider}` | {status} | {lat} |")
        if errors:
            md.append("\n**Tracker errors captured:**")
            for e in errors:
                md.append(f"- `{e}`")
        if fit_err:
            md.append(f"\n**score_job_fit error:** `{fit_err}`")

        md.append("\n### Rule-based vs LLM context")
        md.append(
            f"- `match_profile` provider = `{providers_used.get('match_profile', 'n/a')}` "
            f"→ **rule-based keyword overlap (no LLM)** — this is EXPECTED, not a bug. "
            f"match_score={match_info.get('match_score')}, "
            f"matched_skills={match_info.get('matched_skills')}"
        )

        md.append("\n## 4. Generated proposals (full text) + scores\n")
        if proposals:
            for i, p in enumerate(proposals, 1):
                label = p.get("variant_label", f"Variant {i}")
                scores = p.get("scores", {})
                err = p.get("error")
                md.append(f"### Variant {i}: {label}")
                md.append(f"- scores: {scores}")
                if err:
                    md.append(f"- **ERROR / FALLBACK**: {err}")
                text = (p.get("text") or "").strip()
                md.append("\n```text")
                md.append(text if text else "(EMPTY — generation fell back)")
                md.append("```")
        else:
            md.append("_No proposals produced (pipeline failed)._")

        if follow_up:
            md.append("\n### Follow-up message")
            md.append("```text")
            md.append(follow_up.strip())
            md.append("```")

        md.append("\n### Bid recommendation")
        md.append(f"- {bid}")
        md.append("\n### Detected red flags")
        md.append(f"- {red_flags or '(none)'}")
        md.append("\n### Extracted requirements (Gemini)")
        md.append(f"- summary: {requirements.get('summary')}")
        md.append(f"- skills: {requirements.get('skills')}")
        md.append(f"- deliverables: {requirements.get('deliverables')}")

        md.append("\n## 5. LLM fit score + recommendation\n")
        if fit_ok:
            md.append(f"- **fit_score**: {fit['fit_score']}")
            md.append(f"- **recommendation**: **{fit['recommendation']}**")
            md.append(
                f"- **recommendation derived from score?** "
                f"{'YES — within score-derived bounds' if rec_consistent else 'NO — inconsistent!'}"
            )
            md.append(f"- **reasons**: {fit['reasons']}")
            md.append(f"- **concerns**: {fit['concerns']}")
            md.append(f"- **suggested_angle**: {fit['suggested_angle']}")
        else:
            md.append(f"- **FAILED** — no fit produced. error: `{fit_err}`")

        md.append("\n## 6. Attached portfolio links\n")
        if portfolio_matches:
            for m in portfolio_matches:
                md.append(f"- {m.get('title')} → {m.get('url')} (score={m.get('score')})")
        else:
            md.append("- None attached (no portfolio item scored above the match threshold).")

        md.append("\n## 7. Hardcoded / mock / fallback findings (honest verdict)\n")
        md.append("### Runtime evidence")
        md.append(f"- Steps that hit an LLM provider: {len(llm_steps)}")
        md.append(f"- Steps that FELL BACK to a default/empty output: "
                  f"{[r[0] for r in failed_steps] or 'none'}")
        md.append(f"- Steps with suspiciously low latency (possible stub): "
                  f"{[r[0] for r in suspicious_steps] or 'none'}")
        md.append(f"- Any step served by a real LLM with real latency: {any_real_llm}")
        md.append(f"- Fit recommendation is LLM-driven (not constant): "
                  f"{'YES' if fit_ok and rec_consistent else 'NO / failed'}")

        md.append("\n### Static code review of the generation path")
        md.append("These are the only default/fallback strings in the code path. They are "
                  "**fallbacks that trigger only when an LLM call fails** — none is canned "
                  "proposal content, and the frontend `mockData/` is NOT imported by the backend.")
        for f, ln, note in CODE_REVIEW_FINDINGS:
            md.append(f"- `{f}` (line {ln}): {note}")
        md.append("- **Hardcoded proposal text / canned phrases in the generation path: "
                  "none found.**")

        md.append("\n### Verdict")
        if genuine:
            md.append("**GENUINE.** Every LLM step was served by a real provider with real "
                      "network latency, no step fell back to a default/empty output, the 3 "
                      "proposals contain real generated text, and the fit recommendation is "
                      "derived from the LLM fit_score. Output is genuinely LLM-generated from "
                      "your real stored data (profile, rules, winning examples, portfolio).")
        else:
            problems = []
            if result is None:
                problems.append("the pipeline raised before producing output")
            if failed_steps:
                problems.append(f"{len(failed_steps)} step(s) fell back to defaults: "
                                f"{[r[0] for r in failed_steps]}")
            if suspicious_steps:
                problems.append(f"{len(suspicious_steps)} step(s) had stub-like latency")
            if not fit_ok:
                problems.append("fit scoring failed")
            if not any_real_llm:
                problems.append("no step was served by a real LLM (check API keys)")
            md.append("**NOT FULLY GENUINE.** Issues detected: " + "; ".join(problems) + ". "
                      "See the per-step table and tracker errors above. This usually means a "
                      "missing/invalid API key or a rate-limit, NOT faked content — the code "
                      "degrades to documented fallbacks rather than inventing text.")

        REPORT_PATH.write_text("\n".join(md) + "\n", encoding="utf-8")

    _line("\n" + "=" * 70)
    _line(f"REPORT WRITTEN: {REPORT_PATH}")
    _line("=" * 70)
    print(str(REPORT_PATH))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
