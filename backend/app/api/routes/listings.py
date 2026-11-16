from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import DB, CurrentUser, OptionalUser, require_roles
from app.data import places
from app.data.categories import CATEGORY_BY_SLUG
from app.services.geo import bounding_box, haversine_km, public_coord
from app.db.session import utcnow
from app.models import Claim, ClaimStatus, Listing, ListingStatus, Role, Stage, User
from app.schemas import ClaimIn, ClaimOut, ListingIn, ListingOut, ListingPage, MyClaimOut, UserBrief
from app.services.lifecycle import (
    LifecycleError,
    can_claim_role,
    lifecycle_windows,
    stage_ends_at,
    stage_filter,
    stage_of,
    suggest_price,
)
from app.core.config import get_settings

router = APIRouter(prefix="/api", tags=["listings"])

OPEN_CLAIM = (ClaimStatus.pending, ClaimStatus.accepted)


def claim_block_reason(db: Session, listing: Listing, user: User | None, stage: Stage, now: datetime) -> str | None:
    """Why `user` can't claim `listing` right now, or None if they can."""
    if user is None:
        return "Sign in to request this item."
    if listing.donor_id == user.id:
        return "This is your listing."
    if listing.status != ListingStatus.active:
        return "Someone has already reserved this item."
    if stage == Stage.expired:
        return "This item is past its best-before time."
    if not can_claim_role(user.role, stage):
        if stage == Stage.free:
            opens = listing.priority_until.strftime("%d %b, %H:%M UTC")
            return f"Free items go to NGOs, schools and people in need first. It opens to everyone on {opens}."
        return "At this stage only repairers and recyclers can request it."
    if any(c.claimant_id == user.id and c.status in OPEN_CLAIM for c in listing.claims):
        return "You've already requested this item."
    if stage == Stage.free and user.role == Role.individual:
        active = db.scalar(
            select(func.count(Claim.id)).where(
                Claim.claimant_id == user.id, Claim.stage == Stage.free, Claim.status.in_(OPEN_CLAIM)
            )
        )
        limit = get_settings().max_active_free_claims_individual
        if active >= limit:
            return f"You can hold up to {limit} free requests at a time. Complete or cancel one first."
    return None


def to_out(db: Session, listing: Listing, viewer: User | None, now: datetime, distance_km: float | None = None) -> ListingOut:
    stage = stage_of(listing, now)
    mine = next((c for c in listing.claims if viewer and c.claimant_id == viewer.id and c.status != ClaimStatus.cancelled), None)
    reason = claim_block_reason(db, listing, viewer, stage, now)
    # Exact location only for the donor and for someone whose request was accepted; everyone else sees ~100 m.
    exact = bool(viewer and (viewer.id == listing.donor_id or (mine and mine.status in (ClaimStatus.accepted, ClaimStatus.completed))))
    lat, lng = (listing.lat, listing.lng) if exact else (public_coord(listing.lat), public_coord(listing.lng))
    return ListingOut(
        id=listing.id, title=listing.title, description=listing.description, category=listing.category,
        subcategory=listing.subcategory, quantity=listing.quantity, unit=listing.unit, condition=listing.condition,
        city=listing.city, area=listing.area, lat=lat, lng=lng, location_exact=exact,
        distance_km=round(distance_km, 2) if distance_km is not None else None, price_inr=listing.price_inr,
        status=listing.status, stage=stage, stage_ends_at=stage_ends_at(listing, stage),
        priority_until=listing.priority_until, marketplace_until=listing.marketplace_until, created_at=listing.created_at,
        donor=UserBrief.model_validate(listing.donor),
        claim_count=sum(1 for c in listing.claims if c.status in OPEN_CLAIM),
        is_owner=bool(viewer and viewer.id == listing.donor_id),
        my_claim_id=mine.id if mine else None,
        my_claim_status=mine.status if mine else None,
        can_claim=reason is None,
        claim_blocked_reason=reason,
    )


def load_listing(db: Session, listing_id: int) -> Listing:
    listing = db.scalar(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.claims), selectinload(Listing.donor))
    )
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")
    return listing


@router.get("/listings", response_model=ListingPage)
def list_listings(
    db: DB,
    viewer: OptionalUser,
    category: str | None = None,
    stage: Stage | None = None,
    city: str | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    mine: bool = False,
    near_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    near_lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float, Query(gt=0, le=100)] = 10,
    sort: Literal["newest", "distance"] = "newest",
    limit: Annotated[int, Query(ge=1, le=300)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ListingPage:
    if (near_lat is None) != (near_lng is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Send both near_lat and near_lng.")
    if sort == "distance" and near_lat is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Sorting by distance needs a location.")
    now = utcnow()
    stmt = select(Listing)
    if mine:
        if viewer is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in first.")
        stmt = stmt.where(Listing.donor_id == viewer.id, Listing.status != ListingStatus.withdrawn)
    else:
        stmt = stmt.where(Listing.status == ListingStatus.active)
        if stage is None:  # by default hide expired food
            stmt = stmt.where(or_(stage_filter(Stage.free, now), stage_filter(Stage.marketplace, now), stage_filter(Stage.recycle, now)))
    if stage is not None:
        stmt = stmt.where(stage_filter(stage, now))
    if category:
        stmt = stmt.where(Listing.category == category)
    if city:
        stmt = stmt.where(func.lower(Listing.city) == city.lower())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Listing.title).like(like), func.lower(Listing.description).like(like)))

    loaded = stmt.options(selectinload(Listing.claims), selectinload(Listing.donor)).order_by(Listing.created_at.desc())

    if near_lat is not None and near_lng is not None:
        box = bounding_box(near_lat, near_lng, radius_km)
        candidates = db.scalars(
            loaded.where(Listing.lat.between(box.min_lat, box.max_lat), Listing.lng.between(box.min_lng, box.max_lng))
        ).all()
        within = [(l, d) for l in candidates if (d := haversine_km(near_lat, near_lng, l.lat, l.lng)) <= radius_km]
        if sort == "distance":
            within.sort(key=lambda pair: pair[1])
        page = within[offset : offset + limit]
        return ListingPage(items=[to_out(db, l, viewer, now, d) for l, d in page], total=len(within))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(loaded.limit(limit).offset(offset)).all()
    return ListingPage(items=[to_out(db, l, viewer, now) for l in rows], total=total)


@router.post("/listings", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(
    body: ListingIn,
    db: DB,
    user: Annotated[User, Depends(require_roles(Role.donor, Role.business, Role.organisation, Role.individual, Role.recycler))],
) -> ListingOut:
    now = utcnow()
    try:
        priority_until, marketplace_until = lifecycle_windows(body.category, now, body.best_before)
    except LifecycleError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    lat, lng = body.lat, body.lng
    if lat is None or lng is None:
        lat, lng = places.resolve(body.area, body.city) or (None, None)
    listing = Listing(
        donor_id=user.id, title=body.title.strip(), description=body.description.strip(), category=body.category,
        subcategory=body.subcategory, quantity=body.quantity, unit=CATEGORY_BY_SLUG[body.category].unit,
        condition=body.condition, city=body.city.strip(), area=body.area.strip(), lat=lat, lng=lng,
        original_price_inr=body.original_price_inr, price_inr=suggest_price(body.original_price_inr, body.condition),
        priority_until=priority_until, marketplace_until=marketplace_until, created_at=now,
    )
    db.add(listing)
    db.commit()
    return to_out(db, load_listing(db, listing.id), user, now)


@router.get("/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: DB, viewer: OptionalUser) -> ListingOut:
    listing = load_listing(db, listing_id)
    if listing.status == ListingStatus.withdrawn and not (viewer and viewer.id == listing.donor_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")
    return to_out(db, listing, viewer, utcnow())


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_listing(listing_id: int, db: DB, user: CurrentUser) -> None:
    listing = load_listing(db, listing_id)
    if listing.donor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the donor can remove this listing.")
    if listing.status == ListingStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "This item has already been handed over.")
    listing.status = ListingStatus.withdrawn
    for c in listing.claims:
        if c.status in OPEN_CLAIM:
            c.status = ClaimStatus.declined
    db.commit()


# ---------------- claims ----------------
@router.post("/listings/{listing_id}/claims", response_model=ClaimOut, status_code=status.HTTP_201_CREATED)
def create_claim(listing_id: int, body: ClaimIn, db: DB, user: CurrentUser) -> Claim:
    listing = load_listing(db, listing_id)
    now = utcnow()
    stage = stage_of(listing, now)
    reason = claim_block_reason(db, listing, user, stage, now)
    if reason:
        raise HTTPException(status.HTTP_409_CONFLICT, reason)
    claim = Claim(listing_id=listing.id, claimant_id=user.id, stage=stage, message=body.message.strip())
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


@router.get("/listings/{listing_id}/claims", response_model=list[ClaimOut])
def listing_claims(listing_id: int, db: DB, user: CurrentUser) -> list[Claim]:
    listing = load_listing(db, listing_id)
    if listing.donor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the donor can see requests for this item.")
    return list(listing.claims)


def _load_claim(db: Session, claim_id: int) -> Claim:
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    return claim


@router.post("/claims/{claim_id}/accept", response_model=ClaimOut)
def accept_claim(claim_id: int, db: DB, user: CurrentUser) -> Claim:
    claim = _load_claim(db, claim_id)
    listing = claim.listing
    if listing.donor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the donor can accept requests.")
    if claim.status != ClaimStatus.pending or listing.status != ListingStatus.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request can't be accepted any more.")
    claim.status = ClaimStatus.accepted
    listing.status = ListingStatus.reserved
    for other in listing.claims:
        if other.id != claim.id and other.status == ClaimStatus.pending:
            other.status = ClaimStatus.declined
    db.commit()
    return claim


@router.post("/claims/{claim_id}/decline", response_model=ClaimOut)
def decline_claim(claim_id: int, db: DB, user: CurrentUser) -> Claim:
    claim = _load_claim(db, claim_id)
    if claim.listing.donor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the donor can decline requests.")
    if claim.status != ClaimStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only pending requests can be declined.")
    claim.status = ClaimStatus.declined
    db.commit()
    return claim


@router.post("/claims/{claim_id}/cancel", response_model=ClaimOut)
def cancel_claim(claim_id: int, db: DB, user: CurrentUser) -> Claim:
    claim = _load_claim(db, claim_id)
    if claim.claimant_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only cancel your own requests.")
    if claim.status not in OPEN_CLAIM:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request is already closed.")
    if claim.status == ClaimStatus.accepted:
        claim.listing.status = ListingStatus.active  # back on offer
    claim.status = ClaimStatus.cancelled
    db.commit()
    return claim


@router.post("/claims/{claim_id}/complete", response_model=ClaimOut)
def complete_claim(claim_id: int, db: DB, user: CurrentUser) -> Claim:
    """Donor confirms the handover. (QR/photo proof of delivery arrives with logistics.)"""
    claim = _load_claim(db, claim_id)
    if claim.listing.donor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the donor can confirm the handover.")
    if claim.status != ClaimStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "Accept the request before confirming the handover.")
    claim.status = ClaimStatus.completed
    claim.listing.status = ListingStatus.completed
    db.commit()
    return claim


@router.get("/me/claims", response_model=list[MyClaimOut])
def my_claims(db: DB, user: CurrentUser) -> list[MyClaimOut]:
    claims = db.scalars(
        select(Claim).where(Claim.claimant_id == user.id).options(selectinload(Claim.listing)).order_by(Claim.created_at.desc())
    ).all()
    return [
        MyClaimOut(
            **ClaimOut.model_validate(c).model_dump(),
            listing_title=c.listing.title,
            listing_category=c.listing.category,
        )
        for c in claims
    ]
