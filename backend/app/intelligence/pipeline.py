"""
Proposal generation pipeline — plain Python steps in sequence (no LangGraph).

Input: a Job already in the DB + extracted profile dict.
Output: requirements, match, red flags, bid, scored proposals, follow-up, metadata.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.intelligence.portfolio_match import match_portfolio
from app.intelligence.portfolio_outcome_learning import record_proposal_portfolio_links
from app.intelligence.proposal_rules import load_proposal_voice_rules, resolve_voice_rules_block
from app.intelligence.winning_proposals import (
    select_winning_examples,
    winning_examples_for_prompt,
)
from app.llm.router import LLMRouter, get_llm_router
from app.models import Job
from app.models_intelligence import GenerationLog, WinningProposal

logger = logging.getLogger(__name__)

PROMPT_VERSION = "proposal-v1.0"

DEFAULT_VARIANT_LABELS = ("Short Direct", "Proof-Based", "Question-Led")

# --- schema hints for Gemini structured steps ---

REQUIREMENTS_SCHEMA = """{
  "skills": ["string"],
  "deliverables": ["string"],
  "tone": "string",
  "budget_signals": "string",
  "summary": "string"
}"""

RED_FLAGS_SCHEMA = """{
  "red_flags": ["string — each a short flag like scope creep, lowball budget, spec work, vague scope, unverified client"]
}"""

BID_SCHEMA = """{
  "suggested_rate_or_range": "string",
  "reasoning": "string",
  "connects_recommendation": "yes | maybe | no",
  "connects_reason": "string — one line why this job is or is not worth Upwork Connects"
}"""

SCORE_PROPOSALS_SCHEMA = """{
  "variants": [
    {
      "variant_label": "string",
      "personalization": 0-100,
      "specificity": 0-100,
      "value": 0-100,
      "call_to_action": 0-100,
      "overall": 0-100
    }
  ]
}"""


class PipelineTracker:
    """Collect per-step latency, provider, and errors."""

    def __init__(self) -> None:
        self.providers_used: dict[str, str] = {}
        self.latency_ms: dict[str, int] = {}
        self.errors: list[dict[str, str]] = []

    def run(
        self,
        step: str,
        fn: Callable[[], Any],
        *,
        default: Any,
        provider: str = "none",
    ) -> Any:
        start = time.perf_counter()
        try:
            result = fn()
            self.providers_used[step] = provider
            return result
        except Exception as exc:
            logger.exception("Pipeline step %s failed", step)
            self.errors.append({step: str(exc)})
            self.providers_used[step] = f"{provider}:failed"
            return default
        finally:
            self.latency_ms[step] = int((time.perf_counter() - start) * 1000)


def _generate_tracked(
    router: LLMRouter,
    tracker: PipelineTracker,
    step: str,
    system: str,
    prompt: str,
    temperature: float = 0.7,
) -> str:
    """Call router.generate() and record which provider served the response."""
    start = time.perf_counter()
    try:
        text = router.generate(system, prompt, temperature)
        tracker.providers_used[step] = router.last_provider_used or "unknown"
        return text
    except Exception as exc:
        logger.exception("Pipeline step %s generate failed", step)
        tracker.errors.append({step: str(exc)})
        tracker.providers_used[step] = f"{router.last_provider_used or 'unknown'}:failed"
        raise
    finally:
        tracker.latency_ms[step] = int((time.perf_counter() - start) * 1000)


def _job_context(job: Job) -> str:
    skills = ", ".join(job.skills or []) or "none listed"
    return (
        f"Title: {job.title}\n"
        f"Budget: {job.budget or 'unknown'} ({job.budget_type or 'unknown'})\n"
        f"Skills: {skills}\n"
        f"Description:\n{job.description or 'No description available.'}\n"
        f"Client rating: {job.client_rating}\n"
        f"Client spend: {job.client_spend}\n"
        f"Country: {job.client_country}\n"
        f"Payment verified: {job.payment_verified}\n"
        f"Job URL: {job.job_url or 'N/A'}\n"
    )


def _profile_context(profile: dict[str, Any]) -> str:
    return json.dumps(profile, indent=2)


def _custom_instructions_block(custom_instructions: str | None) -> str:
    text = (custom_instructions or "").strip()
    if not text:
        return ""
    return f"\n\nADDITIONAL USER INSTRUCTIONS (follow these):\n{text}\n"


def _portfolio_links_block(portfolio_matches: list[dict[str, Any]]) -> str:
    if not portfolio_matches:
        return (
            "\nPORTFOLIO LINKS:\n"
            "No relevant portfolio items matched this job. Do NOT include any portfolio URLs.\n"
            'Include a natural line such as: "I can share relevant samples if needed."\n'
        )
    lines = [f"- {m['title']}: {m['url']}" for m in portfolio_matches[:3]]
    links_text = "\n".join(lines)
    return (
        "\nPORTFOLIO LINKS — include ONLY these links, woven naturally on their own stacked lines "
        '(e.g. "Relevant work:" followed by bullet lines). Do NOT add any other URLs:\n'
        f"Relevant work:\n{links_text}\n"
        "Each variant should include 1-2 of the most relevant links above.\n"
    )


def _variant_portfolio_hint(label: str) -> str:
    hints = {
        "Short Direct": "Keep it concise; include 1 relevant link near the proof point.",
        "Proof-Based": "Lead with proof; include 1-2 relevant links as evidence.",
        "Question-Led": "Include 1 relevant link before your closing discovery question.",
    }
    return hints.get(label, "Include 1-2 relevant links naturally if provided.")


def _tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2}


def extract_requirements(
    job: Job,
    *,
    router: LLMRouter,
    tracker: PipelineTracker,
) -> dict[str, Any]:
    """[Gemini] Extract structured job requirements from ingested job fields."""
    system = (
        "You analyze freelance job postings. Extract requirements from the job data provided. "
        "Return ONLY valid JSON."
    )
    prompt = f"Analyze this job and extract requirements:\n\n{_job_context(job)}"

    def _call() -> dict[str, Any]:
        raw = router.analyze(system, prompt, REQUIREMENTS_SCHEMA)
        return {
            "skills": raw.get("skills") or job.skills or [],
            "deliverables": raw.get("deliverables") or [],
            "tone": raw.get("tone") or "",
            "budget_signals": raw.get("budget_signals") or job.budget or "",
            "summary": raw.get("summary") or "",
        }

    default = {
        "skills": job.skills or [],
        "deliverables": [],
        "tone": "",
        "budget_signals": job.budget or "",
        "summary": (job.description or "")[:300],
    }
    return tracker.run("extract_requirements", _call, default=default, provider="gemini")


def match_profile(job: Job, profile: dict[str, Any]) -> dict[str, Any]:
    """
    [No LLM] Keyword overlap between job skills/title and profile skills/niches.

    Heuristic: tokenize job title + skills and profile skills/niches/services;
    a skill matches if any token overlaps (substring match on tokens >= 3 chars).
    Score = matched job skills / total job skills * 100, with +10 title bonus
    (capped at 100) when any profile token appears in the job title.
    """
    job_skill_list = list(job.skills or [])
    profile_terms: set[str] = set()
    for field in ("skills", "niches", "services", "strengths"):
        for item in profile.get(field) or []:
            profile_terms |= _tokenize(str(item))

    matched_skills: list[str] = []
    for skill in job_skill_list:
        skill_tokens = _tokenize(skill)
        if any(
            st == pt or st in pt or pt in st
            for st in skill_tokens
            for pt in profile_terms
        ):
            matched_skills.append(skill)

    missing_skills = [s for s in job_skill_list if s not in matched_skills]

    base = (len(matched_skills) / max(len(job_skill_list), 1)) * 100
    title_tokens = _tokenize(job.title)
    title_bonus = 10 if title_tokens & profile_terms else 0
    match_score = int(min(100, round(base + title_bonus)))

    return {
        "match_score": match_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
    }


def detect_red_flags(
    job: Job,
    *,
    router: LLMRouter,
    tracker: PipelineTracker,
) -> list[str]:
    """[Gemini] Detect proposal red flags (scope creep, lowball, spec work, etc.)."""
    system = (
        "You evaluate freelance job postings for risk flags. "
        "Look for: scope creep, lowball budget, spec work, vague scope, unverified client. "
        "Return ONLY valid JSON."
    )
    prompt = f"List red flags for this job:\n\n{_job_context(job)}"

    def _call() -> list[str]:
        raw = router.analyze(system, prompt, RED_FLAGS_SCHEMA)
        flags = raw.get("red_flags") or []
        return [str(f).strip() for f in flags if str(f).strip()]

    return tracker.run("detect_red_flags", _call, default=[], provider="gemini")


def recommend_bid(
    job: Job,
    profile: dict[str, Any],
    *,
    router: LLMRouter,
    tracker: PipelineTracker,
) -> dict[str, Any]:
    """[Gemini] Suggest rate/range and whether the job is worth Upwork Connects."""
    system = (
        "You advise freelancers on bidding and whether a job is worth spending Upwork Connects on. "
        "connects_recommendation must be exactly 'yes', 'maybe', or 'no'. "
        "Return ONLY valid JSON."
    )
    prompt = (
        f"Job:\n{_job_context(job)}\n\n"
        f"Freelancer profile:\n{_profile_context(profile)}\n\n"
        "Recommend a bid/rate and Connects spend decision."
    )

    def _call() -> dict[str, Any]:
        raw = router.analyze(system, prompt, BID_SCHEMA)
        rec = str(raw.get("connects_recommendation", "maybe")).lower().strip()
        if rec not in ("yes", "maybe", "no"):
            rec = "maybe"
        return {
            "suggested_rate_or_range": raw.get("suggested_rate_or_range") or "",
            "reasoning": raw.get("reasoning") or "",
            "connects_recommendation": rec,
            "connects_reason": raw.get("connects_reason") or raw.get("reasoning") or "",
        }

    default = {
        "suggested_rate_or_range": job.budget or "",
        "reasoning": "Bid recommendation unavailable — using job budget as reference.",
        "connects_recommendation": "maybe",
        "connects_reason": "Unable to assess — review manually.",
    }
    return tracker.run("recommend_bid", _call, default=default, provider="gemini")


def generate_proposals(
    job: Job,
    profile: dict[str, Any],
    winning_examples: list[dict[str, Any]],
    n: int,
    *,
    router: LLMRouter,
    tracker: PipelineTracker,
    custom_instructions: str = "",
    voice_rules_text: str | None = None,
    portfolio_matches: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    """[Groq → Gemini] Generate n proposal variants using winning examples as style references."""
    labels = list(DEFAULT_VARIANT_LABELS[:n])
    while len(labels) < n:
        labels.append(f"Variant {len(labels) + 1}")

    rules_block = resolve_voice_rules_block(voice_rules_text)
    examples_block = (
        json.dumps(winning_examples, indent=2)
        if winning_examples
        else "No winning examples yet — use a professional, human tone."
    )
    extra = _custom_instructions_block(custom_instructions)
    portfolio_block = _portfolio_links_block(portfolio_matches or [])

    system = (
        "You write Upwork proposals for freelancers. "
        "Match the voice and structure of the winning examples when provided. "
        "Follow every voice rule strictly. "
        "Additional user instructions layer on top of voice rules — never replace them. "
        "Follow PORTFOLIO LINKS instructions exactly — never invent portfolio URLs."
    )

    proposals: list[dict[str, str]] = []

    for label in labels:
        variant_hint = _variant_portfolio_hint(label)
        prompt = (
            f"Write one Upwork proposal variant labeled '{label}'.\n\n"
            f"VOICE RULES:\n{rules_block}\n"
            f"{extra}"
            f"{portfolio_block}"
            f"Variant style: {variant_hint}\n"
            f"\nWINNING EXAMPLES (match this voice, do not copy verbatim):\n{examples_block}\n\n"
            f"JOB:\n{_job_context(job)}\n\n"
            f"FREELANCER PROFILE:\n{_profile_context(profile)}\n\n"
            f"Return ONLY the proposal text for the '{label}' variant — no label header, no markdown fences."
        )
        try:
            text = _generate_tracked(
                router,
                tracker,
                f"generate_proposals_{label.lower()}",
                system,
                prompt,
                temperature=0.75,
            )
            proposals.append({"variant_label": label, "text": text.strip()})
        except Exception:
            proposals.append({
                "variant_label": label,
                "text": "",
                "error": "Generation failed for this variant.",
            })

    return proposals


def score_proposals(
    proposals: list[dict[str, str]],
    job: Job,
    *,
    router: LLMRouter,
    tracker: PipelineTracker,
) -> list[dict[str, Any]]:
    """[Gemini] Score each variant on personalization, specificity, value, CTA, overall."""
    if not proposals or all(not p.get("text") for p in proposals):
        return proposals

    system = (
        "You score Upwork proposal variants on personalization, specificity, value, "
        "and call-to-action quality. Scores are 0-100 integers. Return ONLY valid JSON."
    )
    prompt = (
        f"Job:\n{_job_context(job)}\n\n"
        f"Proposals to score:\n{json.dumps(proposals, indent=2)}\n\n"
        "Score each variant."
    )

    def _call() -> list[dict[str, Any]]:
        raw = router.analyze(system, prompt, SCORE_PROPOSALS_SCHEMA)
        scores_by_label = {
            v.get("variant_label"): v for v in (raw.get("variants") or [])
        }
        scored: list[dict[str, Any]] = []
        for prop in proposals:
            label = prop.get("variant_label", "")
            scores = scores_by_label.get(label, {})
            scored.append({
                **prop,
                "scores": {
                    "personalization": int(scores.get("personalization", 0)),
                    "specificity": int(scores.get("specificity", 0)),
                    "value": int(scores.get("value", 0)),
                    "call_to_action": int(scores.get("call_to_action", 0)),
                    "overall": int(scores.get("overall", 0)),
                },
            })
        return scored

    default = [
        {
            **prop,
            "scores": {
                "personalization": 0,
                "specificity": 0,
                "value": 0,
                "call_to_action": 0,
                "overall": 0,
            },
        }
        for prop in proposals
    ]
    return tracker.run("score_proposals", _call, default=default, provider="gemini")


def generate_follow_up(
    job: Job,
    profile: dict[str, Any],
    *,
    router: LLMRouter,
    tracker: PipelineTracker,
    custom_instructions: str = "",
) -> str:
    """[Groq → Gemini] Short 3-day follow-up message."""
    extra = _custom_instructions_block(custom_instructions)
    system = (
        "You write brief, professional Upwork follow-up messages sent ~3 days after applying. "
        "Keep under 120 words. No generic filler."
    )
    prompt = (
        f"Write a 3-day follow-up for this job application.\n\n"
        f"JOB:\n{_job_context(job)}\n\n"
        f"FREELANCER:\n{_profile_context(profile)}\n"
        f"{extra}\n"
        "Return ONLY the follow-up message text."
    )

    try:
        return _generate_tracked(
            router, tracker, "generate_follow_up", system, prompt, temperature=0.6
        )
    except Exception as exc:
        logger.exception("generate_follow_up failed")
        tracker.errors.append({"generate_follow_up": str(exc)})
        return ""


def _overall_proposal_score(proposals: list[dict[str, Any]]) -> float | None:
    scores = [
        p.get("scores", {}).get("overall", 0)
        for p in proposals
        if p.get("scores")
    ]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 2)


def run_proposal_pipeline(
    session: Session,
    job_id: int,
    profile: dict[str, Any],
    options: dict[str, Any] | None = None,
    *,
    profile_id: int | None = None,
    router: LLMRouter | None = None,
) -> dict[str, Any]:
    """
    Run the full proposal pipeline for a DB job.

    Each step degrades gracefully — one LLM failure does not stop the run.
    Persists a GenerationLog row before returning.
    """
    options = options or {}
    n_variants = int(options.get("n_variants", 3))
    n_variants = max(1, min(5, n_variants))
    custom_instructions = str(options.get("custom_instructions") or "").strip()

    llm = router or get_llm_router(session)
    tracker = PipelineTracker()
    pipeline_start = time.perf_counter()

    job = session.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise ValueError(f"Job {job_id} not found")

    # Load winning proposals and select relevant examples
    all_winning = session.query(WinningProposal).order_by(WinningProposal.created_at.desc()).all()
    selected = select_winning_examples(job.title, job.skills, all_winning, limit=3)
    winning_payload = winning_examples_for_prompt(selected)

    # a. Requirements
    requirements = extract_requirements(job, router=llm, tracker=tracker)

    # b. Profile match (no LLM)
    match_start = time.perf_counter()
    match_result = match_profile(job, profile)
    tracker.latency_ms["match_profile"] = int((time.perf_counter() - match_start) * 1000)
    tracker.providers_used["match_profile"] = "none"

    # b2. Portfolio match (no LLM)
    portfolio_matches: list[dict[str, Any]] = []
    if profile_id is not None:
        portfolio_start = time.perf_counter()
        try:
            portfolio_matches = match_portfolio(
                session, job, profile_id, requirements
            )
        except Exception:
            logger.exception("Portfolio match failed for job_id=%s", job_id)
            portfolio_matches = []
        tracker.latency_ms["match_portfolio"] = int(
            (time.perf_counter() - portfolio_start) * 1000
        )
        tracker.providers_used["match_portfolio"] = "none"

    # c. Red flags
    red_flags = detect_red_flags(job, router=llm, tracker=tracker)

    # d. Bid recommendation
    bid = recommend_bid(job, profile, router=llm, tracker=tracker)

    # e. Generate proposals
    voice_rules_text = load_proposal_voice_rules(session)
    proposals = generate_proposals(
        job,
        profile,
        winning_payload,
        n_variants,
        router=llm,
        tracker=tracker,
        custom_instructions=custom_instructions,
        voice_rules_text=voice_rules_text,
        portfolio_matches=portfolio_matches,
    )

    # f. Score proposals
    scored_proposals = score_proposals(proposals, job, router=llm, tracker=tracker)

    # g. Follow-up
    follow_up = generate_follow_up(
        job,
        profile,
        router=llm,
        tracker=tracker,
        custom_instructions=custom_instructions,
    )

    total_latency = int((time.perf_counter() - pipeline_start) * 1000)
    overall_score = _overall_proposal_score(scored_proposals)

    if job.stage == "found":
        job.stage = "drafted"

    result: dict[str, Any] = {
        "job_id": job_id,
        "requirements": requirements,
        "match": match_result,
        "portfolio_matches": portfolio_matches,
        "red_flags": red_flags,
        "bid": bid,
        "proposals": scored_proposals,
        "follow_up": follow_up,
        "metadata": {
            "prompt_version": PROMPT_VERSION,
            "providers_used": tracker.providers_used,
            "latency_ms": tracker.latency_ms,
            "total_latency_ms": total_latency,
            "errors": tracker.errors,
            "winning_examples_used": [ex.id for ex in selected],
            "n_variants": len(scored_proposals),
            "custom_instructions": custom_instructions or None,
            "profile_id": profile_id,
            "portfolio_links_attached": portfolio_matches,
        },
    }

    log_row = GenerationLog(
        job_id=job_id,
        ran_at=datetime.now(timezone.utc),
        match_score=float(match_result.get("match_score", 0)),
        providers_used=tracker.providers_used,
        prompt_version=PROMPT_VERSION,
        latency_ms=total_latency,
        overall_proposal_score=overall_score,
        n_variants=len(scored_proposals),
        custom_instructions=custom_instructions or None,
        result=result,
    )
    session.add(log_row)
    session.flush()

    if portfolio_matches:
        try:
            record_proposal_portfolio_links(session, log_row.id, portfolio_matches)
        except Exception:
            logger.exception(
                "Failed to record portfolio links for generation_id=%s", log_row.id
            )

    session.commit()
    session.refresh(log_row)

    result["generation_id"] = log_row.id

    return result
