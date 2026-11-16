from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import or_, select

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.core.security import create_session_token, hash_password, verify_password
from app.models import User
from app.schemas import LoginIn, RegisterIn, UserOut, normalise_phone

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session(response: Response, user: User) -> None:
    s = get_settings()
    response.set_cookie(
        key=s.session_cookie,
        value=create_session_token(user.id),
        max_age=s.session_days * 86400,
        httponly=True,
        secure=s.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, response: Response, db: DB) -> User:
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Try signing in.")
    if body.phone and db.scalar(select(User.id).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This mobile number is already registered.")
    user = User(
        role=body.role,
        name=body.name.strip(),
        email=email,
        phone=body.phone,
        city=body.city.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_session(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: DB) -> User:
    ident = body.identifier.strip()
    conditions = [User.email == ident.lower()]
    try:
        phone = normalise_phone(ident)
        if phone:
            conditions.append(User.phone == phone)
    except ValueError:
        pass
    user = db.scalar(select(User).where(or_(*conditions)))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That email/phone and password don't match.")
    _set_session(response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(get_settings().session_cookie, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
