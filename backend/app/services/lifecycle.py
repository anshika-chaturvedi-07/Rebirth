"""The REBIRTH hybrid lifecycle: free first, then low-price marketplace, then repair/recycle.

Everything here is a pure function of timestamps and category rules, which keeps it easy to test
and lets the API filter stages directly in SQL.
"""

from datetime import datetime, timedelta

from sqlalchemy import and_, not_
from sqlalchemy.sql.elements import ColumnElement

from app.core.config import get_settings
from app.data.categories import CATEGORIES, CATEGORY_BY_SLUG
from app.models import Condition, Listing, Role, Stage

PERISHABLE_SLUGS = [c.slug for c in CATEGORIES if c.perishable]

# Share of the original price a buyer pays, by condition. A placeholder until the pricing model (Phase 7).
CONDITION_PRICE_FACTOR = {
    Condition.new: 0.60,
    Condition.good: 0.45,
    Condition.fair: 0.30,
    Condition.needs_repair: 0.15,
}

# Which roles may claim at each stage. Owners can never claim their own listing.
CLAIM_ROLES: dict[Stage, set[str]] = {
    Stage.free: {Role.organisation, Role.individual, Role.admin},
    Stage.marketplace: {r.value for r in Role},
    Stage.recycle: {Role.recycler, Role.admin},
    Stage.expired: set(),
}


class LifecycleError(ValueError):
    pass


def suggest_price(original_price_inr: int | None, condition: str) -> int | None:
    """Fair low price for the marketplace stage, rounded to the nearest ₹10."""
    if not original_price_inr or original_price_inr <= 0:
        return None
    factor = CONDITION_PRICE_FACTOR.get(Condition(condition), 0.3)
    return max(10, int(round(original_price_inr * factor / 10.0)) * 10)


def lifecycle_windows(category: str, created_at: datetime, best_before: datetime | None) -> tuple[datetime, datetime]:
    """Return (priority_until, marketplace_until) for a new listing."""
    cat = CATEGORY_BY_SLUG[category]
    priority_until = created_at + timedelta(hours=cat.priority_window_hours)
    if cat.perishable:
        if best_before is None:
            raise LifecycleError("Perishable items need a 'best before' time.")
        if best_before <= created_at:
            raise LifecycleError("'Best before' must be in the future.")
        return min(priority_until, best_before), best_before
    return priority_until, priority_until + timedelta(days=get_settings().marketplace_days)


def stage_of(listing: Listing, now: datetime) -> Stage:
    if now < listing.priority_until:
        return Stage.free
    if now < listing.marketplace_until:
        return Stage.marketplace
    return Stage.expired if listing.category in PERISHABLE_SLUGS else Stage.recycle


def stage_filter(stage: Stage, now: datetime) -> ColumnElement[bool]:
    """SQL condition matching listings currently in `stage`."""
    perishable = Listing.category.in_(PERISHABLE_SLUGS)
    match stage:
        case Stage.free:
            return Listing.priority_until > now
        case Stage.marketplace:
            return and_(Listing.priority_until <= now, Listing.marketplace_until > now)
        case Stage.recycle:
            return and_(Listing.marketplace_until <= now, not_(perishable))
        case Stage.expired:
            return and_(Listing.marketplace_until <= now, perishable)


def stage_ends_at(listing: Listing, stage: Stage) -> datetime | None:
    if stage == Stage.free:
        return listing.priority_until
    if stage == Stage.marketplace:
        return listing.marketplace_until
    return None


def can_claim_role(role: str, stage: Stage) -> bool:
    return role in CLAIM_ROLES[stage]
