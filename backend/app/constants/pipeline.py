"""Pipeline stage and outcome constants shared by routes and models."""

from typing import Literal

PipelineStage = Literal[
    "found",
    "drafted",
    "submitted",
    "viewed",
    "replied",
    "interview",
    "hired",
    "rejected",
    "archived",
]

JobOutcome = Literal["replied", "interview", "hired", "rejected"]

PIPELINE_STAGES: frozenset[str] = frozenset(
    {
        "found",
        "drafted",
        "submitted",
        "viewed",
        "replied",
        "interview",
        "hired",
        "rejected",
        "archived",
    }
)

JOB_OUTCOMES: frozenset[str] = frozenset({"replied", "interview", "hired", "rejected"})

DEFAULT_STAGE = "found"
