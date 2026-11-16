"""Suggestions: which needs fit an item, which items fit a need, and a personal feed."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import DB, CurrentUser, OptionalUser
from app.api.routes.listings import to_out
from app.api.routes.needs import need_out
from app.db.session import utcnow
from app.models import Listing, ListingStatus, Need, NeedStatus, Role, Stage, User
from app.schemas import ListingOut, NeedOut
from app.services.geo import bounding_box
from app.services.lifecycle import stage_filter
from app.services.matching import Match, rank, score_pair
from app.vision.engine import get_engine

router = APIRouter(prefix="/api", tags=["matching"])

SEARCH_RADIUS_KM = 25


class MatchOut(BaseModel):
    score: float
    components: dict[str, float]
    reasons: list[str]
    distance_km: float | None


class NeedMatchOut(MatchOut):
    need: NeedOut
    listing_id: int
    listing_title: str


class ListingMatchOut(MatchOut):
    listing: ListingOut


class SuggestionsOut(BaseModel):
    for_my_needs: list[ListingMatchOut]  # items that fit what you asked for
    for_my_items: list[NeedMatchOut]  # needs your items could fill


def _semantic(query: str, candidates: list[str]) -> list[float] | None:
    """Semantic similarity via the CLIP text encoder, only if the model is already warm (never block a request)."""
    engine = get_engine()
    if engine is None or not getattr(engine, "ready", False) or not candidates:
        return None
    try:
        return engine.text_similarity(query, candidates)
    except Exception:  # noqa: BLE001 — suggestions must never fail because of the optional model
        return None


def _near(model, lat: float | None, lng: float | None):
    if lat is None or lng is None:
        return True
    box = bounding_box(lat, lng, SEARCH_RADIUS_KM)
    return or_(model.lat.is_(None), model.lat.between(box.min_lat, box.max_lat) & model.lng.between(box.min_lng, box.max_lng))


def needs_for_listing(db: Session, listing: Listing, limit: int) -> list[Match]:
    now = utcnow()
    needs = db.scalars(
        select(Need)
        .where(Need.status == NeedStatus.open, Need.category == listing.category, _near(Need, listing.lat, listing.lng))
        .options(selectinload(Need.requester))
    ).all()
    sem = _semantic(listing.title, [n.title for n in needs])
    pairs = [score_pair(listing, n, now, sem[i] if sem else None) for i, n in enumerate(needs)]
    return rank([p for p in pairs if p], limit)


def listings_for_need(db: Session, need: Need, limit: int) -> list[Match]:
    now = utcnow()
    listings = db.scalars(
        select(Listing)
        .where(
            Listing.status == ListingStatus.active,
            Listing.category == need.category,
            or_(stage_filter(Stage.free, now), stage_filter(Stage.marketplace, now)),
            _near(Listing, need.lat, need.lng),
        )
        .options(selectinload(Listing.claims), selectinload(Listing.donor), selectinload(Listing.photos))
    ).all()
    sem = _semantic(need.title, [l.title for l in listings])
    pairs = [score_pair(l, need, now, sem[i] if sem else None) for i, l in enumerate(listings)]
    return rank([p for p in pairs if p], limit)


def _need_match(m: Match, viewer: User | None) -> NeedMatchOut:
    return NeedMatchOut(
        score=m.score, components=m.components, reasons=m.reasons, distance_km=m.distance_km,
        need=need_out(m.need, viewer), listing_id=m.listing.id, listing_title=m.listing.title,
    )


def _listing_match(db: Session, m: Match, viewer: User | None) -> ListingMatchOut:
    return ListingMatchOut(
        score=m.score, components=m.components, reasons=m.reasons, distance_km=m.distance_km,
        listing=to_out(db, m.listing, viewer, utcnow(), m.distance_km),
    )


@router.get("/listings/{listing_id}/matches", response_model=list[NeedMatchOut])
def matches_for_listing(listing_id: int, db: DB, viewer: OptionalUser, limit: Annotated[int, Query(ge=1, le=20)] = 5):
    """Needs this item could fill, best first."""
    listing = db.get(Listing, listing_id)
    if listing is None or listing.status == ListingStatus.withdrawn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")
    return [_need_match(m, viewer) for m in needs_for_listing(db, listing, limit)]


@router.get("/needs/{need_id}/matches", response_model=list[ListingMatchOut])
def matches_for_need(need_id: int, db: DB, viewer: OptionalUser, limit: Annotated[int, Query(ge=1, le=20)] = 5):
    """Items that fit this need, best first."""
    need = db.get(Need, need_id)
    if need is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Need not found.")
    return [_listing_match(db, m, viewer) for m in listings_for_need(db, need, limit)]


@router.get("/me/suggestions", response_model=SuggestionsOut)
def my_suggestions(db: DB, user: CurrentUser, limit: Annotated[int, Query(ge=1, le=20)] = 8) -> SuggestionsOut:
    """A personal feed: items for your open needs (NGOs, individuals) and needs for your open items (donors)."""
    for_needs: list[Match] = []
    if user.role in (Role.organisation, Role.individual, Role.admin):
        for need in db.scalars(select(Need).where(Need.requester_id == user.id, Need.status == NeedStatus.open)).all():
            for_needs += listings_for_need(db, need, 3)
    for_items: list[Match] = []
    for listing in db.scalars(select(Listing).where(Listing.donor_id == user.id, Listing.status == ListingStatus.active)).all():
        for_items += needs_for_listing(db, listing, 3)

    def dedupe(ms: list[Match], key) -> list[Match]:
        seen, out = set(), []
        for m in sorted(ms, key=lambda m: m.score, reverse=True):
            if key(m) not in seen:
                seen.add(key(m))
                out.append(m)
        return out[:limit]

    return SuggestionsOut(
        for_my_needs=[_listing_match(db, m, user) for m in dedupe(for_needs, lambda m: m.listing.id)],
        for_my_items=[_need_match(m, user) for m in dedupe(for_items, lambda m: (m.listing.id, m.need.id))],
    )
