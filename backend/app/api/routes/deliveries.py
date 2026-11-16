"""Volunteer deliveries: open tasks, route planning, and the pickup -> delivered flow."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import DB, require_roles
from app.db.session import utcnow
from app.data.categories import CATEGORY_BY_SLUG
from app.models import Claim, ClaimStatus, DeliveryStatus, DeliveryTask, Listing, ListingStatus, Role, User
from app.services.geo import haversine_km, public_coord
from app.services.routing import Point, Task, distance_km, plan_route

router = APIRouter(prefix="/api/deliveries", tags=["deliveries"])
Volunteer = Annotated[User, Depends(require_roles(Role.volunteer))]

MAX_ROUTE_TASKS = 8


class Place(BaseModel):
    lat: float
    lng: float
    label: str


class DeliveryOut(BaseModel):
    id: int
    status: str
    is_mine: bool
    item: str
    category: str
    quantity: float
    unit: str
    pickup: Place
    dropoff: Place
    trip_km: float
    distance_km: float | None = None  # from the search point to the pickup
    created_at: str


class PlanIn(BaseModel):
    start_lat: float = Field(ge=-90, le=90)
    start_lng: float = Field(ge=-180, le=180)
    task_ids: list[int] = Field(default_factory=list, max_length=MAX_ROUTE_TASKS)
    max_tasks: int = Field(default=4, ge=1, le=MAX_ROUTE_TASKS)
    radius_km: float = Field(default=25, gt=0, le=50)


class RouteStopOut(BaseModel):
    task_id: int
    kind: Literal["pickup", "dropoff"]
    lat: float
    lng: float
    label: str
    item: str
    leg_km: float


class RouteOut(BaseModel):
    stops: list[RouteStopOut]
    task_ids: list[int]
    total_km: float
    minutes: int
    solver: str
    naive_km: float  # visiting tasks one by one in list order, for comparison


class AssignIn(BaseModel):
    task_ids: list[int] = Field(min_length=1, max_length=MAX_ROUTE_TASKS)


def _q(db: Session):
    return select(DeliveryTask).options(
        selectinload(DeliveryTask.claim).selectinload(Claim.listing).selectinload(Listing.donor),
        selectinload(DeliveryTask.claim).selectinload(Claim.claimant),
    )


def _out(t: DeliveryTask, user: User, near: tuple[float, float] | None = None) -> DeliveryOut:
    mine = t.volunteer_id == user.id
    # exact addresses only once the volunteer has taken the task
    fix = (lambda v: v) if mine else public_coord
    listing = t.claim.listing
    return DeliveryOut(
        id=t.id, status=t.status, is_mine=mine, item=listing.title, category=listing.category,
        quantity=listing.quantity, unit=listing.unit,
        pickup=Place(lat=fix(t.pickup_lat), lng=fix(t.pickup_lng), label=t.pickup_label),
        dropoff=Place(lat=fix(t.dropoff_lat), lng=fix(t.dropoff_lng), label=t.dropoff_label),
        trip_km=round(distance_km(Point(t.pickup_lat, t.pickup_lng), Point(t.dropoff_lat, t.dropoff_lng)), 2),
        distance_km=round(haversine_km(near[0], near[1], t.pickup_lat, t.pickup_lng), 2) if near else None,
        created_at=t.created_at.isoformat() + "Z",
    )


@router.get("", response_model=list[DeliveryOut])
def list_deliveries(
    db: DB,
    user: Volunteer,
    scope: Literal["open", "mine"] = "open",
    near_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    near_lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float, Query(gt=0, le=50)] = 25,
) -> list[DeliveryOut]:
    if scope == "mine":
        rows = db.scalars(_q(db).where(DeliveryTask.volunteer_id == user.id).order_by(DeliveryTask.created_at.desc())).all()
        return [_out(t, user) for t in rows]
    rows = db.scalars(_q(db).where(DeliveryTask.status == DeliveryStatus.open).order_by(DeliveryTask.created_at)).all()
    if near_lat is None or near_lng is None:
        return [_out(t, user) for t in rows]
    near = (near_lat, near_lng)
    within = [t for t in rows if haversine_km(near_lat, near_lng, t.pickup_lat, t.pickup_lng) <= radius_km]
    within.sort(key=lambda t: haversine_km(near_lat, near_lng, t.pickup_lat, t.pickup_lng))
    return [_out(t, user, near) for t in within]


@router.post("/plan", response_model=RouteOut)
def plan(body: PlanIn, db: DB, user: Volunteer) -> RouteOut:
    """Plan one route over the chosen tasks (or the nearest open ones), plus anything you're already carrying."""
    start = Point(body.start_lat, body.start_lng)
    mine = db.scalars(
        _q(db).where(DeliveryTask.volunteer_id == user.id, DeliveryTask.status.in_([DeliveryStatus.assigned, DeliveryStatus.picked_up]))
    ).all()
    if body.task_ids:
        chosen = db.scalars(_q(db).where(DeliveryTask.id.in_(body.task_ids))).all()
        bad = [t.id for t in chosen if not (t.status == DeliveryStatus.open or t.volunteer_id == user.id)]
        if bad or len(chosen) != len(set(body.task_ids)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Some of those deliveries were taken by someone else. Refresh and try again.")
    else:
        open_ = db.scalars(_q(db).where(DeliveryTask.status == DeliveryStatus.open)).all()
        near = [t for t in open_ if haversine_km(start.lat, start.lng, t.pickup_lat, t.pickup_lng) <= body.radius_km]
        near.sort(key=lambda t: haversine_km(start.lat, start.lng, t.pickup_lat, t.pickup_lng))
        chosen = near[: max(0, body.max_tasks - len(mine))]

    tasks_by_id = {t.id: t for t in [*mine, *chosen]}
    tasks: list[Task] = []
    for t in tasks_by_id.values():
        # already picked up: only the drop-off is left, so its "pickup" is where the volunteer is now
        pickup = start if t.status == DeliveryStatus.picked_up else Point(t.pickup_lat, t.pickup_lng)
        perishable = CATEGORY_BY_SLUG[t.claim.listing.category].perishable
        tasks.append(Task(t.id, pickup, Point(t.dropoff_lat, t.dropoff_lng), perishable))
    route = plan_route(start, tasks)

    naive_stops = []
    for task in tasks:
        naive_stops += [task.pickup, task.dropoff]
    pts = [start, *naive_stops]
    naive = round(sum(distance_km(a, b) for a, b in zip(pts, pts[1:])), 2)

    stops: list[RouteStopOut] = []
    for stop, leg in zip(route.stops, route.legs_km):
        t = tasks_by_id[stop.task_id]
        if stop.kind == "pickup" and t.status == DeliveryStatus.picked_up:
            continue  # nothing to collect
        exact = t.volunteer_id == user.id
        lat, lng = (stop.point.lat, stop.point.lng) if exact else (public_coord(stop.point.lat), public_coord(stop.point.lng))
        stops.append(RouteStopOut(
            task_id=t.id, kind=stop.kind, lat=lat, lng=lng, leg_km=leg, item=t.claim.listing.title,
            label=t.pickup_label if stop.kind == "pickup" else t.dropoff_label,
        ))
    return RouteOut(stops=stops, task_ids=list(tasks_by_id), total_km=route.total_km, minutes=route.minutes, solver=route.solver, naive_km=naive)


@router.post("/assign", response_model=list[DeliveryOut])
def assign(body: AssignIn, db: DB, user: Volunteer) -> list[DeliveryOut]:
    tasks = db.scalars(_q(db).where(DeliveryTask.id.in_(body.task_ids))).all()
    if len(tasks) != len(set(body.task_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Some deliveries no longer exist.")
    taken = [t for t in tasks if t.status != DeliveryStatus.open and t.volunteer_id != user.id]
    if taken:
        raise HTTPException(status.HTTP_409_CONFLICT, "Another volunteer just took one of these. Refresh and plan again.")
    now = utcnow()
    for t in tasks:
        if t.status == DeliveryStatus.open:
            t.status, t.volunteer_id, t.assigned_at = DeliveryStatus.assigned, user.id, now
    db.commit()
    return [_out(t, user) for t in tasks]


def _mine(db: Session, task_id: int, user: User) -> DeliveryTask:
    t = db.scalar(_q(db).where(DeliveryTask.id == task_id))
    if t is None or t.volunteer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That delivery isn't assigned to you.")
    return t


@router.post("/{task_id}/pickup", response_model=DeliveryOut)
def picked_up(task_id: int, db: DB, user: Volunteer) -> DeliveryOut:
    t = _mine(db, task_id, user)
    if t.status != DeliveryStatus.assigned:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only assigned deliveries can be picked up.")
    t.status, t.picked_up_at = DeliveryStatus.picked_up, utcnow()
    db.commit()
    return _out(t, user)


@router.post("/{task_id}/deliver", response_model=DeliveryOut)
def delivered(task_id: int, db: DB, user: Volunteer) -> DeliveryOut:
    t = _mine(db, task_id, user)
    if t.status != DeliveryStatus.picked_up:
        raise HTTPException(status.HTTP_409_CONFLICT, "Mark it as picked up first.")
    t.status, t.delivered_at = DeliveryStatus.delivered, utcnow()
    t.claim.status = ClaimStatus.completed
    t.claim.listing.status = ListingStatus.completed
    db.commit()
    return _out(t, user)


@router.post("/{task_id}/release", response_model=DeliveryOut)
def release(task_id: int, db: DB, user: Volunteer) -> DeliveryOut:
    """Hand a task back to the pool (before pickup)."""
    t = _mine(db, task_id, user)
    if t.status != DeliveryStatus.assigned:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can only hand back a delivery before picking it up.")
    t.status, t.volunteer_id, t.assigned_at = DeliveryStatus.open, None, None
    db.commit()
    return _out(t, user)
