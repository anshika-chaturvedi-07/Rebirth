"""Three years of SIMULATED REBIRTH activity, so forecasting and impact analytics have data to work on.

Everything here is synthetic and labelled as such in the UI and README. The patterns are plausible for
Bengaluru, not measured:
  * winter clothing & blanket demand peaks Nov–Jan;
  * textbooks: supply after exams (Mar–Apr), demand when schools reopen (May–Jun);
  * food surplus jumps around Diwali (Oct–Nov) and wedding season;
  * construction material supply dips in the monsoon (Jun–Sep);
  * electronics grow steadily.
Generated deterministically (fixed seed) so tests and screenshots are repeatable.
"""

import math
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.data import places
from app.data.categories import CATEGORY_BY_SLUG
from app.db.session import utcnow
from app.models import Claim, ClaimStatus, Listing, ListingStatus, Need, NeedStatus, Role, Stage, User
from app.services.lifecycle import suggest_price

WEEKS = 156  # three years: seasonal models need two full years plus held-out weeks
SEED = 2026

COMMUNITY_DONORS = [
    ("donor", "Koramangala Residents' Welfare Assn"), ("business", "GreenBasket Market"),
    ("business", "Skyline Builders"), ("donor", "Indiranagar Apartment Drive"), ("business", "TechPark Cafeteria"),
    ("business", "Uniform House"), ("donor", "Jayanagar Parents Collective"), ("business", "Comfort Linens"),
]
COMMUNITY_RECEIVERS = [
    ("organisation", "Annapurna Community Kitchen"), ("organisation", "Little Steps Children Home"),
    ("organisation", "Village Library Project"), ("organisation", "BuildTogether Collective"),
    ("organisation", "Code Saathi Learning Hub"), ("individual", "Priya S."), ("individual", "Imran K."),
]


def month_peak(week_start: datetime, months: dict[int, float]) -> float:
    """Multiplier for the month of this week (1.0 when not listed)."""
    return months.get(week_start.month, 1.0)


# category: (supply/week, demand/week (requests run ~1.2x the typical qty, so off-season demand ≈ supply in kg), typical qty, supply seasonality, demand seasonality, growth over 3 years)
PROFILES: dict[str, tuple[float, float, tuple[float, float], dict[int, float], dict[int, float], float]] = {
    "food": (5.0, 4.3, (8, 45), {10: 1.6, 11: 1.8, 12: 1.3, 2: 1.2}, {11: 1.1, 12: 1.2, 1: 1.2}, 0.35),
    "clothing": (2.2, 1.35, (5, 30), {3: 1.5, 4: 1.4, 10: 1.6}, {11: 2.4, 12: 3.0, 1: 2.6, 2: 1.4}, 0.20),
    "books": (1.6, 1.05, (4, 25), {3: 2.2, 4: 2.4}, {5: 2.6, 6: 3.0, 7: 1.4}, 0.15),
    "furniture": (1.4, 1.05, (1, 12), {4: 1.3, 10: 1.3}, {6: 1.8, 7: 1.4}, 0.10),
    "electronics": (1.2, 0.95, (1, 6), {}, {6: 1.3, 7: 1.3}, 0.60),
    "construction": (1.0, 0.7, (80, 600), {6: 0.4, 7: 0.3, 8: 0.4, 9: 0.6}, {6: 0.5, 7: 0.5, 8: 0.6}, 0.25),
}

# share of handovers by stage (free / marketplace / recycle)
STAGE_MIX = {"food": (0.82, 0.18, 0.0), "construction": (0.35, 0.40, 0.25), "electronics": (0.45, 0.30, 0.25)}
DEFAULT_MIX = (0.62, 0.26, 0.12)


def poisson(rng: random.Random, lam: float) -> int:
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= l:
            return k
        k += 1


def generate(db: Session, demo_users: dict[str, User]) -> dict[str, int]:
    rng = random.Random(SEED)
    now = utcnow()
    areas = list(places.LOCALITIES["Bengaluru"].items())

    demo_donors = [demo_users["meera"], demo_users["brightlabs"], demo_users["dadi"]]
    demo_receivers = [demo_users["fatima"], demo_users["hope"], demo_users["aarav"]]
    donors: list[User] = []
    receivers: list[User] = []
    for role, name in COMMUNITY_DONORS + COMMUNITY_RECEIVERS:
        slug = "".join(ch for ch in name.lower() if ch.isalnum())[:24]
        u = User(role=role, name=name, email=f"{slug}@history.rebirth.test", city="Bengaluru",
                 password_hash="!", verified=role == Role.organisation)  # "!" can never match a bcrypt hash: no sign-in
        db.add(u)
        (donors if (role, name) in COMMUNITY_DONORS else receivers).append(u)
    db.flush()

    def pick(community: list[User], demo: list[User]) -> User:
        # demo accounts get an occasional share, so their impact pages have numbers without flooding their lists
        return rng.choice(demo) if rng.random() < 0.05 else rng.choice(community)

    counts = {"listings": 0, "handovers": 0, "needs": 0}
    start = now - timedelta(weeks=WEEKS)
    for w in range(WEEKS):
        week_start = start + timedelta(weeks=w)
        growth_t = w / WEEKS
        for cat, (s_rate, d_rate, (q_lo, q_hi), s_season, d_season, growth) in PROFILES.items():
            spec = CATEGORY_BY_SLUG[cat]
            trend = 1 + growth * growth_t
            # --- supply: listings, most of which found a home
            for _ in range(poisson(rng, s_rate * trend * month_peak(week_start, s_season))):
                created = week_start + timedelta(hours=rng.uniform(0, 7 * 24))
                area, (lat, lng) = rng.choice(areas)
                qty = round(rng.uniform(q_lo, q_hi), 0 if spec.unit == "items" else 1) or 1
                donor = pick(donors, demo_donors)
                cond = rng.choice(["new", "good", "good", "fair", "needs_repair"])
                listing = Listing(
                    donor=donor, title=f"{spec.name} donation", category=cat, quantity=qty, unit=spec.unit,
                    condition=cond, city="Bengaluru", area=area, lat=lat + rng.uniform(-0.004, 0.004),
                    lng=lng + rng.uniform(-0.004, 0.004), created_at=created,
                    priority_until=created + timedelta(hours=spec.priority_window_hours),
                    marketplace_until=created + timedelta(days=14), description="Simulated history (demo data).",
                )
                outcome = rng.random()
                if outcome < 0.86:  # found a new home
                    free, market, _ = STAGE_MIX.get(cat, DEFAULT_MIX)
                    r = rng.random()
                    stage = Stage.free if r < free else Stage.marketplace if r < free + market else Stage.recycle
                    if stage == Stage.marketplace:
                        listing.price_inr = suggest_price(rng.randint(500, 20000), cond)
                    listing.status = ListingStatus.completed
                    claimant = pick(receivers, demo_receivers) if stage == Stage.free else rng.choice(receivers + donors)
                    if claimant.id == donor.id:
                        claimant = receivers[0]
                    done_at = created + timedelta(hours=rng.uniform(1, 72))
                    db.add(Claim(listing=listing, claimant=claimant, stage=stage, status=ClaimStatus.completed,
                                 created_at=done_at, updated_at=done_at))
                    counts["handovers"] += 1
                else:
                    listing.status = ListingStatus.withdrawn
                db.add(listing)
                counts["listings"] += 1
            # --- demand: needs posted
            for _ in range(poisson(rng, d_rate * trend * month_peak(week_start, d_season))):
                created = week_start + timedelta(hours=rng.uniform(0, 7 * 24))
                area, (lat, lng) = rng.choice(areas)
                qty = round(rng.uniform(q_lo, q_hi) * rng.uniform(0.8, 1.6), 0 if spec.unit == "items" else 1) or 1
                db.add(Need(
                    requester=pick(receivers, demo_receivers), title=f"{spec.name} needed", category=cat, quantity=qty,
                    unit=spec.unit, urgency=rng.choice([1, 2, 2, 3]), city="Bengaluru", area=area, lat=lat, lng=lng,
                    status=NeedStatus.fulfilled if rng.random() < 0.8 else NeedStatus.closed, created_at=created,
                    description="Simulated history (demo data).",
                ))
                counts["needs"] += 1
    return counts
