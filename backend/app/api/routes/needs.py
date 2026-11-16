from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, OptionalUser, require_roles
from app.data import places
from app.data.categories import CATEGORY_BY_SLUG
from app.models import Need, NeedStatus, Role, User
from app.schemas import NeedIn, NeedOut, NeedStatusIn
from app.services.geo import bounding_box, haversine_km, public_coord

router = APIRouter(prefix="/api/needs", tags=["needs"])


def need_out(need: Need, viewer: User | None, distance_km: float | None = None) -> NeedOut:
    out = NeedOut.model_validate(need)
    # Organisations' needs are public places; individuals' needs are rounded like donor locations.
    exact = need.requester.role == Role.organisation or bool(viewer and viewer.id == need.requester_id)
    if not exact:
        out.lat, out.lng = public_coord(need.lat), public_coord(need.lng)
    out.location_exact = exact
    out.distance_km = round(distance_km, 2) if distance_km is not None else None
    return out


@router.get("", response_model=list[NeedOut])
def list_needs(
    db: DB,
    viewer: OptionalUser,
    category: str | None = None,
    city: str | None = None,
    mine: bool = False,
    near_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    near_lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float, Query(gt=0, le=100)] = 10,
    sort: Literal["urgency", "distance"] = "urgency",
    limit: Annotated[int, Query(ge=1, le=300)] = 50,
) -> list[NeedOut]:
    if (near_lat is None) != (near_lng is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Send both near_lat and near_lng.")
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
    stmt = stmt.order_by(Need.urgency.desc(), Need.created_at.desc())  # most urgent first, then newest

    if near_lat is not None and near_lng is not None:
        box = bounding_box(near_lat, near_lng, radius_km)
        rows = db.scalars(stmt.where(Need.lat.between(box.min_lat, box.max_lat), Need.lng.between(box.min_lng, box.max_lng))).all()
        within = [(n, d) for n in rows if (d := haversine_km(near_lat, near_lng, n.lat, n.lng)) <= radius_km]
        if sort == "distance":
            within.sort(key=lambda pair: pair[1])
        return [need_out(n, viewer, d) for n, d in within[:limit]]

    return [need_out(n, viewer) for n in db.scalars(stmt.limit(limit)).all()]


@router.post("", response_model=NeedOut, status_code=status.HTTP_201_CREATED)
def create_need(
    body: NeedIn,
    db: DB,
    user: Annotated[User, Depends(require_roles(Role.organisation, Role.individual))],
) -> NeedOut:
    lat, lng = body.lat, body.lng
    if lat is None or lng is None:
        lat, lng = places.resolve(body.area, body.city) or (None, None)
    need = Need(
        requester_id=user.id, title=body.title.strip(), description=body.description.strip(), category=body.category,
        quantity=body.quantity, unit=CATEGORY_BY_SLUG[body.category].unit, urgency=body.urgency,
        city=body.city.strip(), area=body.area.strip(), lat=lat, lng=lng, needed_by=body.needed_by,
    )
    db.add(need)
    db.commit()
    db.refresh(need)
    return need_out(need, user)


@router.get("/{need_id}", response_model=NeedOut)
def get_need(need_id: int, db: DB, viewer: OptionalUser) -> NeedOut:
    need = db.get(Need, need_id)
    if need is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Need not found.")
    return need_out(need, viewer)


@router.patch("/{need_id}", response_model=NeedOut)
def update_need_status(need_id: int, body: NeedStatusIn, db: DB, user: CurrentUser) -> NeedOut:
    need = db.get(Need, need_id)
    if need is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Need not found.")
    if need.requester_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organisation that posted this need can change it.")
    need.status = body.status
    db.commit()
    return need_out(need, user)
