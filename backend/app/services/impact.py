"""Impact and circular-economy metrics, computed from completed handovers.

A handover = a request (claim) marked completed: the item really changed hands.
Per handover:  kg = quantity × kg_per_unit;  CO2e avoided = kg × category factor;  water = kg × water factor;
meals = food kg / 0.42.  Factors are indicative averages and are labelled as such everywhere they appear.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.data.categories import CATEGORY_BY_SLUG
from app.models import Claim, ClaimStatus, DeliveryStatus, DeliveryTask, Listing, ListingStatus

KG_PER_MEAL = 0.42           # WRAP's average meal weight
CAR_KG_CO2E_PER_KM = 0.17    # average passenger car
TREE_KG_CO2_PER_YEAR = 21    # a mature tree absorbs roughly this much per year


@dataclass
class Totals:
    handovers: int = 0
    kg: float = 0.0
    co2e_kg: float = 0.0
    water_l: float = 0.0
    meals: float = 0.0

    def add(self, category: str, quantity: float) -> None:
        c = CATEGORY_BY_SLUG[category]
        kg = quantity * c.kg_per_unit
        self.handovers += 1
        self.kg += kg
        self.co2e_kg += kg * c.co2e_per_kg
        self.water_l += kg * c.water_l_per_kg
        if category == "food":
            self.meals += kg / KG_PER_MEAL

    def out(self) -> dict:
        return {
            "handovers": self.handovers,
            "kg": round(self.kg, 1),
            "co2e_kg": round(self.co2e_kg, 1),
            "water_l": round(self.water_l),
            "meals": round(self.meals),
            "car_km_avoided": round(self.co2e_kg / CAR_KG_CO2E_PER_KM),
            "tree_years": round(self.co2e_kg / TREE_KG_CO2_PER_YEAR, 1),
        }


@dataclass
class Breakdown:
    total: Totals = field(default_factory=Totals)
    by_category: dict[str, Totals] = field(default_factory=lambda: defaultdict(Totals))
    by_month: dict[str, Totals] = field(default_factory=lambda: defaultdict(Totals))

    def add(self, category: str, quantity: float, when: datetime) -> None:
        self.total.add(category, quantity)
        self.by_category[category].add(category, quantity)
        self.by_month[when.strftime("%Y-%m")].add(category, quantity)

    def out(self, months: list[str]) -> dict:
        cats = sorted(self.by_category.items(), key=lambda kv: kv[1].co2e_kg, reverse=True)
        return {
            "total": self.total.out(),
            "by_category": [
                {"category": k, "name": CATEGORY_BY_SLUG[k].name, "icon": CATEGORY_BY_SLUG[k].icon, **v.out()} for k, v in cats
            ],
            "by_month": [{"month": m, **self.by_month[m].out()} for m in months],
        }


def last_months(now: datetime, n: int = 12) -> list[str]:
    y, m = now.year, now.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


def _handovers(db: Session, city: str | None = None, since: datetime | None = None):
    stmt = (
        select(Claim.id, Claim.stage, Claim.updated_at, Claim.claimant_id, Listing.category, Listing.quantity,
               Listing.area, Listing.donor_id)
        .join(Listing, Claim.listing_id == Listing.id)
        .where(Claim.status == ClaimStatus.completed)
    )
    if city:
        stmt = stmt.where(func.lower(Listing.city) == city.lower())
    if since:
        stmt = stmt.where(Claim.updated_at >= since)
    return db.execute(stmt).all()


def city_impact(db: Session, city: str, now: datetime) -> dict:
    rows = _handovers(db, city)
    months = last_months(now)
    b = Breakdown()
    stages: dict[str, int] = defaultdict(int)
    areas: dict[str, dict] = defaultdict(lambda: {"rehomed": 0, "kg": 0.0, "co2e_kg": 0.0, "free": 0})
    for r in rows:
        b.add(r.category, r.quantity, r.updated_at)
        stages[r.stage] += 1
        a = areas[r.area or city]
        c = CATEGORY_BY_SLUG[r.category]
        a["rehomed"] += 1
        a["kg"] += r.quantity * c.kg_per_unit
        a["co2e_kg"] += r.quantity * c.kg_per_unit * c.co2e_per_kg
        a["free"] += r.stage == "free"

    # rehome rate: of listings whose journey has ended (handed over or withdrawn), how many found a home
    ended = db.execute(
        select(Listing.area, Listing.status, func.count())
        .where(func.lower(Listing.city) == city.lower(), Listing.status.in_([ListingStatus.completed, ListingStatus.withdrawn]))
        .group_by(Listing.area, Listing.status)
    ).all()
    listed_by_area: dict[str, int] = defaultdict(int)
    completed = withdrawn = 0
    for area, st, n in ended:
        listed_by_area[area or city] += n
        if st == ListingStatus.completed:
            completed += n
        else:
            withdrawn += n

    total_stage = sum(stages.values()) or 1
    neighbourhoods = sorted(
        (
            {
                "area": area,
                "rehomed": v["rehomed"],
                "listed": listed_by_area.get(area, v["rehomed"]),
                "rehome_rate": round(v["rehomed"] / max(1, listed_by_area.get(area, v["rehomed"])), 3),
                "free_share": round(v["free"] / v["rehomed"], 3) if v["rehomed"] else 0,
                "kg": round(v["kg"], 1),
                "co2e_kg": round(v["co2e_kg"], 1),
            }
            for area, v in areas.items()
        ),
        key=lambda n: n["co2e_kg"],
        reverse=True,
    )
    for n in neighbourhoods:
        # circularity score 0–100: mostly "did things find a home", plus "did people in need get them free"
        n["circularity"] = round(100 * (0.7 * n["rehome_rate"] + 0.3 * n["free_share"]))

    return {
        **b.out(months),
        "stages": [{"stage": s, "handovers": stages.get(s, 0), "share": round(stages.get(s, 0) / total_stage, 3)}
                   for s in ("free", "marketplace", "recycle")],
        "rehome_rate": round(completed / max(1, completed + withdrawn), 3),
        "neighbourhoods": neighbourhoods,
    }


def user_impact(db: Session, user_id: int, now: datetime) -> dict:
    months = last_months(now)
    given, received, delivered = Breakdown(), Breakdown(), Breakdown()
    for r in _handovers(db):
        if r.donor_id == user_id:
            given.add(r.category, r.quantity, r.updated_at)
        if r.claimant_id == user_id:
            received.add(r.category, r.quantity, r.updated_at)
    tasks = db.execute(
        select(Listing.category, Listing.quantity, DeliveryTask.delivered_at)
        .join(Claim, DeliveryTask.claim_id == Claim.id)
        .join(Listing, Claim.listing_id == Listing.id)
        .where(DeliveryTask.volunteer_id == user_id, DeliveryTask.status == DeliveryStatus.delivered)
    ).all()
    for cat, qty, when in tasks:
        delivered.add(cat, qty, when)
    return {"given": given.out(months), "received": received.out(months), "delivered": delivered.out(months)}


def hotspots(db: Session, city: str, kind: str, now: datetime, days: int = 180, cell_deg: float = 0.01, min_count: int = 3) -> list[dict]:
    """Aggregate supply (listings) or demand (needs) into ~1 km grid cells.
    Cells with fewer than `min_count` records are dropped so no single household can be singled out."""
    from app.models import Need  # local import keeps the module's top tidy

    model = Listing if kind == "supply" else Need
    since = now - timedelta(days=days)
    rows = db.execute(
        select(model.lat, model.lng, model.category, model.quantity)
        .where(func.lower(model.city) == city.lower(), model.created_at >= since, model.lat.is_not(None))
    ).all()
    cells: dict[tuple[int, int], dict] = {}
    for lat, lng, cat, qty in rows:
        key = (round(lat / cell_deg), round(lng / cell_deg))
        cell = cells.setdefault(key, {"count": 0, "kg": 0.0})
        cell["count"] += 1
        cell["kg"] += qty * CATEGORY_BY_SLUG[cat].kg_per_unit
    return [
        {"lat": round(k[0] * cell_deg, 4), "lng": round(k[1] * cell_deg, 4), "count": v["count"], "kg": round(v["kg"], 1)}
        for k, v in cells.items()
        if v["count"] >= min_count
    ]
