from fastapi import HTTPException

from app.constants.portfolio_taxonomy import PORTFOLIO_SOURCE_TYPES, PORTFOLIO_TAXONOMY
from app.models_portfolio import PortfolioItem


def validate_taxonomy(main_category: str, sub_category: str) -> None:
    subs = PORTFOLIO_TAXONOMY.get(main_category)
    if subs is None:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid main_category {main_category!r}.",
        )
    if sub_category not in subs:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sub_category {sub_category!r} for {main_category!r}.",
        )


def validate_source_type(source_type: str) -> None:
    if source_type not in PORTFOLIO_SOURCE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source_type {source_type!r}.",
        )


def normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    return [t.strip() for t in tags if t and str(t).strip()]


def item_matches_tag(item: PortfolioItem, tag: str) -> bool:
    needle = tag.strip().lower()
    if not needle:
        return True
    all_tags = (
        (item.industry_tags or [])
        + (item.skill_tags or [])
        + (item.style_tags or [])
        + (item.tools_tags or [])
    )
    return any(needle == t.lower() for t in all_tags)
