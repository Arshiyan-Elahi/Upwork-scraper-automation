"""
Select the most relevant winning proposals for style reference.

Heuristic: token overlap between job title/skills and proposal niche/title/text.
"""

from __future__ import annotations

import re
from typing import Any

from app.models_intelligence import WinningProposal

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(*parts: str | None) -> set[str]:
    blob = " ".join(p for p in parts if p).lower()
    return {t for t in _TOKEN_RE.findall(blob) if len(t) > 2}


def _overlap_score(job_tokens: set[str], proposal: WinningProposal) -> float:
    prop_tokens = _tokens(proposal.niche, proposal.job_title, proposal.text[:500])
    if not job_tokens or not prop_tokens:
        return 0.0
    intersection = job_tokens & prop_tokens
    return len(intersection) / max(len(job_tokens), 1)


def select_winning_examples(
    job_title: str,
    job_skills: list[str] | None,
    proposals: list[WinningProposal],
    *,
    limit: int = 3,
) -> list[WinningProposal]:
    """Return up to `limit` winning proposals ranked by relevance to the job."""
    if not proposals:
        return []

    job_tokens = _tokens(job_title, " ".join(job_skills or []))
    ranked = sorted(
        proposals,
        key=lambda p: _overlap_score(job_tokens, p),
        reverse=True,
    )
    return ranked[:limit]


def winning_examples_for_prompt(examples: list[WinningProposal]) -> list[dict[str, Any]]:
    return [
        {
            "job_title": ex.job_title,
            "niche": ex.niche,
            "outcome": ex.outcome,
            "text": ex.text,
            "notes": ex.notes,
        }
        for ex in examples
    ]
