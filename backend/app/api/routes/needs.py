from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, OptionalUser, require_roles
from app.data.categories import CATEGORY_BY_SLUG
from app.models import Need, NeedStatus, Role, User
from app.schemas import NeedIn, NeedOut, NeedStatusIn

router = APIRouter(prefix="/api/needs", tags=["needs"])


@router.get("", response_model=list[NeedOut])
def list_needs(
    db: DB,
    viewer: OptionalUser,
    category: str | None = None,
    city: str | None = None,
    mine: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[Need]:
    stmt = select(Need).options(selectinload(Need.requester))
    if mine:
        if viewer is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in first.")
        stmt = stmt.where(Need.requester_id == viewer.id)
    else:
        stmt = stmt.where(Need.status == NeedStatus.open)
    if category:
        stmt = stmt.where(Need.category == category)
    if city:
        stmt = stmt.where(func.lower(Need.city) == city.lower())
    # most urgent first, then newest
    return list(db.scalars(stmt.order_by(Need.urgency.desc(), Need.created_at.desc()).limit(limit)).all())


@router.post("", response_model=NeedOut, status_code=status.HTTP_201_CREATED)
def create_need(
    body: NeedIn,
    db: DB,
    user: Annotated[User, Depends(require_roles(Role.organisation, Role.individual))],
) -> Need:
    need = Need(
        requester_id=user.id, title=body.title.strip(), description=body.description.strip(), category=body.category,
        quantity=body.quantity, unit=CATEGORY_BY_SLUG[body.category].unit, urgency=body.urgency,
        city=body.city.strip(), area=body.area.strip(), lat=body.lat, lng=body.lng, needed_by=body.needed_by,
    )
    db.add(need)
    db.commit()
    db.refresh(need)
    return need


@router.get("/{need_id}", response_model=NeedOut)
def get_need(need_id: int, db: DB) -> Need:
    need = db.get(Need, need_id)
    if need is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Need not found.")
    return need


@router.patch("/{need_id}", response_model=NeedOut)
def update_need_status(need_id: int, body: NeedStatusIn, db: DB, user: CurrentUser) -> Need:
    need = db.get(Need, need_id)
    if need is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Need not found.")
    if need.requester_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organisation that posted this need can change it.")
    need.status = body.status
    db.commit()
    return need
