from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import read_session_token
from app.db.session import get_db
from app.models import User

DB = Annotated[Session, Depends(get_db)]


def _token_from(request: Request) -> str | None:
    token = request.cookies.get(get_settings().session_cookie)
    if token:
        return token
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return None


def get_optional_user(request: Request, db: DB) -> User | None:
    token = _token_from(request)
    if not token:
        return None
    user_id = read_session_token(token)
    return db.get(User, user_id) if user_id else None


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in first.")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[[User], User]:
    def checker(user: CurrentUser) -> User:
        if user.role not in roles and user.role != "admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account type can't do this.")
        return user

    return checker
