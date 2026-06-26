"""Authentication routes: signup, login, logout, current user."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import backfill_unowned_data_to_first_user, get_db
from app.models_user import User
from app.schemas_auth import (
    LoginRequest,
    MessageResponse,
    SignupRequest,
    TokenResponse,
    UserRead,
)
from app.security.auth import create_access_token, get_current_user
from app.security.passwords import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> User:
    email = _normalize_email(body.email)

    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    is_first_user = db.query(User).count() == 0

    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    # The very first account claims any pre-existing (legacy) data so nothing is
    # lost when an already-deployed single-user DB becomes multi-user.
    if is_first_user:
        backfill_unowned_data_to_first_user()

    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = _normalize_email(body.email)
    user = db.query(User).filter(User.email == email).first()

    # Same generic message whether the email or password is wrong.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/logout", response_model=MessageResponse)
def logout(_current: User = Depends(get_current_user)) -> MessageResponse:
    # Stateless JWT: the client discards the token. This endpoint just confirms.
    return MessageResponse(message="Logged out.")


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
