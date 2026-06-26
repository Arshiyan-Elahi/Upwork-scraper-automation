"""Central per-user data scoping.

Every read/write/delete of per-user data MUST go through a ``UserScope`` bound to
the authenticated user. This is the single enforced mechanism that filters every
per-user query by ``user_id`` — routes never hand-roll their own ``user_id`` filter.

Jobs are SHARED and are intentionally NOT scoped here.
"""

from __future__ import annotations

from typing import TypeVar

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Query, Session

from app.db import get_db
from app.models_user import User
from app.security.auth import get_current_user

T = TypeVar("T")


class UserScope:
    """Query/persistence helper bound to one authenticated user.

    ``model`` must expose a ``user_id`` column. Any model passed here is, by
    definition, per-user data — so isolation cannot be bypassed by forgetting a
    filter at the call site.
    """

    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user
        self.user_id = user.id

    def query(self, model: type[T]) -> Query:
        """A query for ``model`` already filtered to the current user's rows."""
        return self.session.query(model).filter(model.user_id == self.user_id)

    def get(self, model: type[T], pk: int) -> T | None:
        return self.query(model).filter(model.id == pk).first()

    def get_or_404(self, model: type[T], pk: int, detail: str = "Not found") -> T:
        obj = self.get(model, pk)
        if obj is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        return obj

    def add(self, obj: T) -> T:
        """Stamp the row with the current user and stage it for insert."""
        obj.user_id = self.user_id
        self.session.add(obj)
        return obj


def get_scope(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserScope:
    return UserScope(db, current_user)
