import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.intelligence.profile import extract_profile, normalize_extracted
from app.llm.errors import LLMConfigurationError, LLMError
from app.models_portfolio import PortfolioItem
from app.models_profile import Profile
from app.portfolio.utils import item_matches_tag, normalize_tags, validate_source_type, validate_taxonomy
from app.schemas_portfolio import PortfolioItemCreate, PortfolioItemRead
from app.schemas_profile import ProfileCreate, ProfileExtracted, ProfileRead, ProfileUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _to_profile_read(profile: Profile) -> ProfileRead:
    extracted = ProfileExtracted.model_validate(normalize_extracted(profile.extracted))
    return ProfileRead(
        id=profile.id,
        name=profile.name,
        raw_input=profile.raw_input,
        extracted=extracted,
        upwork_profile_url=profile.upwork_profile_url,
        behance_url=profile.behance_url,
        is_active=profile.is_active,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def _get_profile_or_404(db: Session, profile_id: int) -> Profile:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile


def _extract_and_save(
    db: Session,
    profile: Profile,
    *,
    raw_text: str | None = None,
) -> Profile:
    if raw_text is not None:
        text = raw_text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="raw_text must not be empty.")
        try:
            profile.extracted = extract_profile(text, session=db)
            profile.raw_input = text
        except LLMConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except LLMError as exc:
            logger.exception("Profile extraction LLM error")
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Unexpected profile extraction error")
            raise HTTPException(status_code=500, detail="Profile extraction failed.") from exc
    db.commit()
    db.refresh(profile)
    return profile


@router.get("", response_model=list[ProfileRead])
def list_profiles(db: Session = Depends(get_db)) -> list[ProfileRead]:
    rows = db.query(Profile).order_by(Profile.is_active.desc(), Profile.created_at.asc()).all()
    return [_to_profile_read(row) for row in rows]


@router.post("", response_model=ProfileRead, status_code=201)
def create_profile(body: ProfileCreate, db: Session = Depends(get_db)) -> ProfileRead:
    raw_text = body.raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="raw_text must not be empty.")

    has_active = db.query(Profile).filter(Profile.is_active.is_(True)).first() is not None

    try:
        extracted = extract_profile(raw_text, session=db)
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMError as exc:
        logger.exception("Profile extraction LLM error")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected profile extraction error")
        raise HTTPException(status_code=500, detail="Profile extraction failed.") from exc

    profile = Profile(
        name=body.name.strip(),
        raw_input=raw_text,
        extracted=extracted,
        upwork_profile_url=(body.upwork_profile_url or "").strip() or None,
        behance_url=(body.behance_url or "").strip() or None,
        is_active=not has_active,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _to_profile_read(profile)


@router.get("/{profile_id}", response_model=ProfileRead)
def get_profile(profile_id: int, db: Session = Depends(get_db)) -> ProfileRead:
    return _to_profile_read(_get_profile_or_404(db, profile_id))


@router.put("/{profile_id}", response_model=ProfileRead)
def update_profile(
    profile_id: int,
    body: ProfileUpdate,
    db: Session = Depends(get_db),
) -> ProfileRead:
    profile = _get_profile_or_404(db, profile_id)

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name must not be empty.")
        profile.name = name
    if body.upwork_profile_url is not None:
        profile.upwork_profile_url = body.upwork_profile_url.strip() or None
    if body.behance_url is not None:
        profile.behance_url = body.behance_url.strip() or None

    if body.raw_text is not None:
        _extract_and_save(db, profile, raw_text=body.raw_text)
    else:
        db.commit()
        db.refresh(profile)

    return _to_profile_read(profile)


@router.delete("/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    profile = _get_profile_or_404(db, profile_id)
    was_active = profile.is_active
    db.delete(profile)
    db.commit()

    if was_active:
        replacement = db.query(Profile).order_by(Profile.created_at.asc()).first()
        if replacement is not None:
            replacement.is_active = True
            db.commit()

    return {"id": profile_id, "deleted": True}


@router.put("/{profile_id}/activate", response_model=ProfileRead)
def activate_profile(profile_id: int, db: Session = Depends(get_db)) -> ProfileRead:
    profile = _get_profile_or_404(db, profile_id)
    db.query(Profile).filter(Profile.id != profile_id).update({Profile.is_active: False})
    profile.is_active = True
    db.commit()
    db.refresh(profile)
    return _to_profile_read(profile)


@router.post("/{profile_id}/portfolio", response_model=PortfolioItemRead, status_code=201)
def create_portfolio_item(
    profile_id: int,
    body: PortfolioItemCreate,
    db: Session = Depends(get_db),
) -> PortfolioItemRead:
    _get_profile_or_404(db, profile_id)
    validate_source_type(body.source_type)
    validate_taxonomy(body.main_category, body.sub_category)

    item = PortfolioItem(
        profile_id=profile_id,
        title=body.title.strip(),
        url=body.url.strip(),
        source_type=body.source_type,
        main_category=body.main_category,
        sub_category=body.sub_category,
        industry_tags=normalize_tags(body.industry_tags),
        skill_tags=normalize_tags(body.skill_tags),
        style_tags=normalize_tags(body.style_tags),
        tools_tags=normalize_tags(body.tools_tags),
        description=(body.description or "").strip() or None,
        priority_score=body.priority_score,
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{profile_id}/portfolio", response_model=list[PortfolioItemRead])
def list_portfolio_items(
    profile_id: int,
    db: Session = Depends(get_db),
    main_category: str | None = Query(None),
    sub_category: str | None = Query(None),
    source_type: str | None = Query(None),
    tag: str | None = Query(None),
    search: str | None = Query(None),
    include_inactive: bool = Query(False),
) -> list[PortfolioItemRead]:
    _get_profile_or_404(db, profile_id)

    query = db.query(PortfolioItem).filter(PortfolioItem.profile_id == profile_id)
    if not include_inactive:
        query = query.filter(PortfolioItem.is_active.is_(True))
    if main_category:
        query = query.filter(PortfolioItem.main_category == main_category)
    if sub_category:
        query = query.filter(PortfolioItem.sub_category == sub_category)
    if source_type:
        validate_source_type(source_type)
        query = query.filter(PortfolioItem.source_type == source_type)
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            or_(
                PortfolioItem.title.ilike(needle),
                PortfolioItem.description.ilike(needle),
            )
        )

    rows = query.order_by(
        PortfolioItem.priority_score.desc(),
        PortfolioItem.updated_at.desc(),
    ).all()

    if tag:
        rows = [row for row in rows if item_matches_tag(row, tag)]

    return rows
