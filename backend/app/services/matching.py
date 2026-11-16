"""Explainable matching between listings (supply) and needs (demand).

Each listing–need pair gets a score in [0, 1]: a weighted sum of interpretable components. Every
component also produces a plain-language reason, so people can see *why* something was suggested.

Hard rules first (no score at all): same category, item still open in the free or marketplace stage,
need still open, and nobody is matched with themselves.

The weights are hand-set for now. The components are logged as features so a learned ranker
(e.g. LightGBM on accepted/declined suggestions) can replace them once there is real usage data.
"""

import math
import re
from dataclasses import dataclass, field
from datetime import datetime

from app.models import Listing, ListingStatus, Need, NeedStatus, Role, Stage
from app.services.geo import haversine_km
from app.services.lifecycle import stage_of

WEIGHTS: dict[str, float] = {
    "distance": 0.25,   # closer is cheaper and faster to move
    "relevance": 0.20,  # how well the item text fits the need text
    "urgency": 0.15,    # the need's own urgency
    "coverage": 0.15,   # how much of the need this item covers
    "cost": 0.10,       # free items beat marketplace items for people in need
    "time": 0.10,       # items about to leave the free window or expire go first
    "trust": 0.05,      # verified organisations
}
assert abs(sum(WEIGHTS.values()) - 1) < 1e-9

DISTANCE_SCALE_KM = 5.0  # score halves roughly every 3.5 km
MIN_SCORE = 0.25

STOPWORDS = {
    "a", "an", "the", "and", "or", "for", "of", "to", "in", "on", "with", "our", "my", "we", "need", "needs", "needed",
    "some", "any", "new", "old", "used", "good", "working", "set", "pieces", "piece", "items", "item", "kg", "two", "three",
    "per", "every", "from", "this", "that", "is", "are", "be", "it", "its", "into", "as", "at", "by", "x",
}


def tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower())
    out = set()
    for w in words:
        if w in STOPWORDS or len(w) < 3:
            continue
        # light stemming: chairs -> chair, laptops -> laptop, blankets -> blanket
        if w.endswith("ies") and len(w) > 4:
            w = w[:-3] + "y"
        elif w.endswith("es") and len(w) > 4 and w[-3] in "sxz":
            w = w[:-2]
        elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
            w = w[:-1]
        out.add(w)
    return out


def lexical_relevance(listing: Listing, need: Need) -> tuple[float, list[str]]:
    """Share of the need's title words found in the listing (title, subcategory, description)."""
    want = tokens(need.title)
    have = tokens(f"{listing.title} {listing.subcategory or ''} {listing.description}")
    if not want:
        return 0.5, []
    shared = sorted(want & have)
    score = len(shared) / len(want)
    return min(1.0, 0.35 + 0.65 * score) if shared else 0.35, shared


@dataclass
class Match:
    listing: Listing
    need: Need
    score: float
    components: dict[str, float]
    reasons: list[str] = field(default_factory=list)
    distance_km: float | None = None


def score_pair(listing: Listing, need: Need, now: datetime, semantic: float | None = None) -> Match | None:
    if listing.category != need.category:
        return None
    if listing.status != ListingStatus.active or need.status != NeedStatus.open:
        return None
    if listing.donor_id == need.requester_id:
        return None
    stage = stage_of(listing, now)
    if stage not in (Stage.free, Stage.marketplace):
        return None

    reasons: list[str] = []
    c: dict[str, float] = {}

    # distance
    d = None
    if None not in (listing.lat, listing.lng, need.lat, need.lng):
        d = haversine_km(listing.lat, listing.lng, need.lat, need.lng)
        c["distance"] = math.exp(-d / DISTANCE_SCALE_KM)
        reasons.append(f"{d:.1f} km apart" if d >= 1 else "Less than 1 km apart")
    else:
        c["distance"] = 0.3

    # relevance: lexical overlap, upgraded by semantic similarity when the AI text model is available
    lex, shared = lexical_relevance(listing, need)
    c["relevance"] = max(lex, semantic) if semantic is not None else lex
    if shared:
        reasons.append("Matches “" + ", ".join(shared[:3]) + "”")
    elif semantic is not None and semantic >= 0.6:
        reasons.append("Similar kind of item")

    # urgency
    c["urgency"] = need.urgency / 3
    if need.urgency == 3:
        reasons.append("Urgent need")

    # coverage
    cover = min(listing.quantity, need.quantity) / need.quantity if need.quantity else 0
    c["coverage"] = cover
    unit = "" if listing.unit == "items" else f" {listing.unit}"
    if cover >= 0.999:
        reasons.append("Covers the whole need")
    else:
        reasons.append(f"Covers {listing.quantity:g}{unit} of {need.quantity:g}{unit} needed")

    # cost
    c["cost"] = 1.0 if stage == Stage.free else 0.4
    reasons.append("Free right now" if stage == Stage.free else "Low-price marketplace item")

    # time pressure
    ends = listing.priority_until if stage == Stage.free else listing.marketplace_until
    hours_left = max(0.0, (ends - now).total_seconds() / 3600)
    c["time"] = 1.0 if hours_left < 6 else 0.6 if hours_left < 48 else 0.3
    if hours_left < 6:
        reasons.append("Needs a home within hours")

    # trust
    verified_org = need.requester.role == Role.organisation and need.requester.verified
    c["trust"] = 1.0 if verified_org else 0.6
    if verified_org:
        reasons.append("Verified organisation")

    total = sum(WEIGHTS[k] * v for k, v in c.items())
    return Match(listing, need, round(total, 4), {k: round(v, 3) for k, v in c.items()}, reasons, d)


def rank(pairs: list[Match], limit: int) -> list[Match]:
    good = [m for m in pairs if m.score >= MIN_SCORE]
    good.sort(key=lambda m: (m.score, -(m.distance_km or 0)), reverse=True)
    return good[:limit]
