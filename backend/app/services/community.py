"""Badges, display names, ratings and leaderboards."""

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.data.categories import CATEGORY_BY_SLUG
from app.models import Claim, ClaimStatus, DeliveryStatus, DeliveryTask, Listing, Review, Role, User

PERSONAL_ROLES = (Role.donor, Role.individual, Role.volunteer)


def display_name(user: User) -> str:
    """Organisations and businesses use their name; people are shown as first name + last initial."""
    if user.role not in PERSONAL_ROLES:
        return user.name
    parts = [p for p in user.name.replace("·", " ").split() if p]
    if len(parts) <= 1:
        return parts[0] if parts else "Member"
    return f"{parts[0]} {parts[-1][0]}."


def rating(db: Session, user_id: int) -> tuple[float | None, int]:
    avg, n = db.execute(select(func.avg(Review.stars), func.count(Review.id)).where(Review.subject_id == user_id)).one()
    return (round(float(avg), 2) if avg is not None else None), int(n)


def _given(db: Session, user_id: int):
    return db.execute(
        select(Listing.category, Listing.quantity, Claim.updated_at)
        .join(Claim, Claim.listing_id == Listing.id)
        .where(Listing.donor_id == user_id, Claim.status == ClaimStatus.completed)
    ).all()


def _week(d: datetime) -> tuple[int, int]:
    iso = d.isocalendar()
    return iso[0], iso[1]


BADGES = [
    ("first_gift", "First gift", "🎁", "Gave something a second life"),
    ("food_hero", "Food hero", "🍲", "Rescued 100 kg of food"),
    ("climate_champion", "Climate champion", "🌍", "Avoided 1 tonne of CO₂e"),
    ("steady_giver", "Steady giver", "🔥", "Handed something on in 4 different weeks"),
    ("road_warrior", "Road warrior", "🚚", "Completed 5 volunteer deliveries"),
    ("trusted", "Trusted", "⭐", "4.5★ or better from at least 3 reviews"),
    ("verified", "Verified organisation", "🛡️", "Registration checked by the REBIRTH team"),
]


def badges(db: Session, user: User) -> list[dict]:
    given = _given(db, user.id)
    food_kg = sum(q * CATEGORY_BY_SLUG[c].kg_per_unit for c, q, _ in given if c == "food")
    co2e = sum(q * CATEGORY_BY_SLUG[c].kg_per_unit * CATEGORY_BY_SLUG[c].co2e_per_kg for c, q, _ in given)
    weeks = len({_week(when) for _, _, when in given})
    deliveries = db.scalar(select(func.count(DeliveryTask.id)).where(
        DeliveryTask.volunteer_id == user.id, DeliveryTask.status == DeliveryStatus.delivered)) or 0
    avg, n = rating(db, user.id)
    progress = {
        "first_gift": min(1.0, len(given) / 1),
        "food_hero": min(1.0, food_kg / 100),
        "climate_champion": min(1.0, co2e / 1000),
        "steady_giver": min(1.0, weeks / 4),
        "road_warrior": min(1.0, deliveries / 5),
        "trusted": 1.0 if (n >= 3 and (avg or 0) >= 4.5) else min(0.99, n / 3) if n < 3 else 0.5,
        "verified": 1.0 if user.verified else 0.0,
    }
    relevant = {
        "road_warrior": user.role == Role.volunteer,
        "verified": user.role == Role.organisation,
        "first_gift": user.role != Role.volunteer,
        "food_hero": user.role != Role.volunteer,
        "climate_champion": user.role != Role.volunteer,
        "steady_giver": user.role != Role.volunteer,
    }
    return [
        {"code": code, "name": name, "icon": icon, "description": desc,
         "progress": round(progress[code], 3), "earned": progress[code] >= 1.0}
        for code, name, icon, desc in BADGES
        if relevant.get(code, True)
    ]


def leaderboard(db: Session, now: datetime, days: int, limit: int = 10) -> dict:
    since = now - timedelta(days=days)
    rows = db.execute(
        select(Listing.donor_id, Listing.category, Listing.quantity)
        .join(Claim, Claim.listing_id == Listing.id)
        .where(Claim.status == ClaimStatus.completed, Claim.updated_at >= since)
    ).all()
    givers: dict[int, dict] = defaultdict(lambda: {"co2e_kg": 0.0, "kg": 0.0, "handovers": 0})
    for donor_id, cat, qty in rows:
        c = CATEGORY_BY_SLUG[cat]
        g = givers[donor_id]
        g["kg"] += qty * c.kg_per_unit
        g["co2e_kg"] += qty * c.kg_per_unit * c.co2e_per_kg
        g["handovers"] += 1
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(list(givers)))).all()} if givers else {}
    top_givers = sorted(
        ({"user_id": uid, "name": display_name(users[uid]), "role": users[uid].role, "verified": users[uid].verified,
          **{k: round(v, 1) if isinstance(v, float) else v for k, v in g.items()}}
         for uid, g in givers.items() if uid in users),
        key=lambda r: r["co2e_kg"], reverse=True,
    )[:limit]

    vol_rows = db.execute(
        select(DeliveryTask.volunteer_id, func.count(DeliveryTask.id))
        .where(DeliveryTask.status == DeliveryStatus.delivered, DeliveryTask.delivered_at >= since)
        .group_by(DeliveryTask.volunteer_id)
    ).all()
    vol_users = {u.id: u for u in db.scalars(select(User).where(User.id.in_([v for v, _ in vol_rows]))).all()} if vol_rows else {}
    top_volunteers = sorted(
        ({"user_id": vid, "name": display_name(vol_users[vid]), "deliveries": n} for vid, n in vol_rows if vid in vol_users),
        key=lambda r: r["deliveries"], reverse=True,
    )[:limit]

    area_rows = db.execute(
        select(Listing.area, Listing.category, Listing.quantity)
        .join(Claim, Claim.listing_id == Listing.id)
        .where(Claim.status == ClaimStatus.completed, Claim.updated_at >= since)
    ).all()
    areas: dict[str, dict] = defaultdict(lambda: {"co2e_kg": 0.0, "handovers": 0})
    for area, cat, qty in area_rows:
        c = CATEGORY_BY_SLUG[cat]
        areas[area or "Other"]["co2e_kg"] += qty * c.kg_per_unit * c.co2e_per_kg
        areas[area or "Other"]["handovers"] += 1
    top_areas = sorted(({"area": a, "co2e_kg": round(v["co2e_kg"], 1), "handovers": v["handovers"]} for a, v in areas.items()),
                       key=lambda r: r["co2e_kg"], reverse=True)[:limit]
    # People who *receive* help never appear on a leaderboard.
    return {"days": days, "givers": top_givers, "volunteers": top_volunteers, "neighbourhoods": top_areas}
