import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.constants.portfolio_taxonomy import PORTFOLIO_SOURCE_TYPES, PORTFOLIO_TAXONOMY
from app.db import get_db
from app.intelligence.portfolio_analyze import analyze_portfolio_item
from app.models_portfolio import PortfolioItem
from app.portfolio.utils import normalize_tags, validate_source_type, validate_taxonomy
from app.schemas_portfolio import (
    PortfolioAnalyzeInput,
    PortfolioAnalyzeResult,
    PortfolioItemRead,
    PortfolioItemUpdate,
    PortfolioTaxonomyRead,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["portfolio"])


@router.get("/portfolio/taxonomy", response_model=PortfolioTaxonomyRead)
def get_portfolio_taxonomy() -> PortfolioTaxonomyRead:
    return PortfolioTaxonomyRead(
        taxonomy=PORTFOLIO_TAXONOMY,
        source_types=list(PORTFOLIO_SOURCE_TYPES),
    )


@router.post("/portfolio/analyze", response_model=PortfolioAnalyzeResult)
def analyze_portfolio_draft(
    body: PortfolioAnalyzeInput,
    db: Session = Depends(get_db),
) -> PortfolioAnalyzeResult:
    """Suggest categories and tags for an unsaved portfolio item (does not persist)."""
    result = analyze_portfolio_item(
        db,
        title=body.title or "",
        url=body.url or "",
        description=body.description,
        source_type=body.source_type,
    )
    return PortfolioAnalyzeResult(**result)


@router.post("/portfolio/{item_id}/analyze", response_model=PortfolioAnalyzeResult)
def analyze_portfolio_by_id(
    item_id: int,
    body: PortfolioAnalyzeInput | None = None,
    db: Session = Depends(get_db),
) -> PortfolioAnalyzeResult:
    """Suggest categories and tags for a saved item; body fields override stored values."""
    item = db.query(PortfolioItem).filter(PortfolioItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Portfolio item not found.")

    overrides = body or PortfolioAnalyzeInput()
    result = analyze_portfolio_item(
        db,
        title=(overrides.title or item.title).strip(),
        url=(overrides.url or item.url).strip(),
        description=overrides.description if overrides.description is not None else item.description,
        source_type=overrides.source_type or item.source_type,
    )
    return PortfolioAnalyzeResult(**result)


@router.get("/portfolio/{item_id}", response_model=PortfolioItemRead)
def get_portfolio_item(item_id: int, db: Session = Depends(get_db)) -> PortfolioItemRead:
    item = db.query(PortfolioItem).filter(PortfolioItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Portfolio item not found.")
    return item


@router.put("/portfolio/{item_id}", response_model=PortfolioItemRead)
def update_portfolio_item(
    item_id: int,
    body: PortfolioItemUpdate,
    db: Session = Depends(get_db),
) -> PortfolioItemRead:
    item = db.query(PortfolioItem).filter(PortfolioItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Portfolio item not found.")

    main_category = body.main_category if body.main_category is not None else item.main_category
    sub_category = body.sub_category if body.sub_category is not None else item.sub_category
    if body.main_category is not None or body.sub_category is not None:
        validate_taxonomy(main_category, sub_category)

    if body.source_type is not None:
        validate_source_type(body.source_type)

    if body.title is not None:
        item.title = body.title.strip()
    if body.url is not None:
        item.url = body.url.strip()
    if body.source_type is not None:
        item.source_type = body.source_type
    if body.main_category is not None:
        item.main_category = body.main_category
    if body.sub_category is not None:
        item.sub_category = body.sub_category
    if body.industry_tags is not None:
        item.industry_tags = normalize_tags(body.industry_tags)
    if body.skill_tags is not None:
        item.skill_tags = normalize_tags(body.skill_tags)
    if body.style_tags is not None:
        item.style_tags = normalize_tags(body.style_tags)
    if body.tools_tags is not None:
        item.tools_tags = normalize_tags(body.tools_tags)
    if body.description is not None:
        item.description = body.description.strip() or None
    if body.priority_score is not None:
        item.priority_score = body.priority_score
    if body.is_active is not None:
        item.is_active = body.is_active

    db.commit()
    db.refresh(item)
    return item


@router.delete("/portfolio/{item_id}")
def delete_portfolio_item(item_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    item = db.query(PortfolioItem).filter(PortfolioItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Portfolio item not found.")
    item.is_active = False
    db.commit()
    return {"id": item_id, "is_active": False}
