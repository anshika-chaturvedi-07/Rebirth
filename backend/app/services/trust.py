"""Trust & safety: registration formats and rule-based risk signals for admins.

Signals are deliberately simple and explainable: each one names the pattern it saw. They never block anyone
automatically; they put an account in front of a human reviewer.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Claim, ClaimStatus, Listing, Report, Role, Stage, User

# NGO Darpan unique ID, e.g. KA/2017/0123456 (state code / year / 7 digits); school UDISE+ code is 11 digits.
FORMATS = {
    "darpan": (re.compile(r"^[A-Z]{2}/\d{4}/\d{7}$"), "NGO Darpan IDs look like KA/2017/0123456."),
    "udise": (re.compile(r"^\d{11}$"), "UDISE codes are 11 digits."),
    "other": (re.compile(r"^[A-Za-z0-9/\-]{4,40}$"), "Use letters, digits, / or - (4 to 40 characters)."),
}


def normalise_reference(kind: str, reference: str) -> str:
    ref = reference.strip().upper().replace(" ", "")
    pattern, hint = FORMATS[kind]
    if not pattern.match(ref):
        raise ValueError(hint)
    return ref


@dataclass
class RiskEntry:
    user: User
    signals: list[dict] = field(default_factory=list)

    @property
    def score(self) -> int:
        return sum(s["weight"] for s in self.signals)


def risk_signals(db: Session, now: datetime, window_days: int = 30) -> list[RiskEntry]:
    since = now - timedelta(days=window_days)
    entries: dict[int, RiskEntry] = {}

    def flag(user: User, code: str, weight: int, detail: str) -> None:
        entries.setdefault(user.id, RiskEntry(user)).signals.append({"code": code, "weight": weight, "detail": detail})

    recent = db.scalars(select(Claim).where(Claim.created_at >= since)).all()
    by_user: dict[int, list[Claim]] = defaultdict(list)
    for c in recent:
        by_user[c.claimant_id].append(c)

    for uid, claims in by_user.items():
        user = claims[0].claimant
        free = [c for c in claims if c.stage == Stage.free and c.status != ClaimStatus.cancelled]
        if user.role == Role.individual and len(free) >= 5:
            flag(user, "many_free_claims", 2, f"{len(free)} free items requested in {window_days} days")
        cancelled = [c for c in claims if c.status == ClaimStatus.cancelled]
        if len(cancelled) >= 3 and len(cancelled) / len(claims) > 0.5:
            flag(user, "frequent_cancellations", 1, f"{len(cancelled)} of {len(claims)} requests cancelled")
        if (now - user.created_at) < timedelta(days=7):
            value = sum(c.listing.price_inr or 0 for c in claims if c.stage == Stage.marketplace)
            if value >= 20000 or len(free) >= 3:
                flag(user, "new_account_large_requests", 1,
                     f"account is {(now - user.created_at).days} days old; {len(free)} free requests, ₹{value:,} marketplace")

    # possible resale: received something free, then listed the same kind of thing with a price within a week
    received = db.scalars(
        select(Claim).where(Claim.status == ClaimStatus.completed, Claim.stage == Stage.free, Claim.updated_at >= since)
    ).all()
    for c in received:
        resold = db.scalar(
            select(Listing).where(
                Listing.donor_id == c.claimant_id, Listing.category == c.listing.category,
                Listing.original_price_inr.is_not(None), Listing.created_at >= c.updated_at,
                Listing.created_at <= c.updated_at + timedelta(days=7),
            )
        )
        if resold is not None:
            flag(c.claimant, "possible_resale", 3,
                 f"got “{c.listing.title}” free, then listed “{resold.title}” with a price {(resold.created_at - c.updated_at).days} days later")

    reports = db.scalars(select(Report).where(Report.status == "open", Report.target_type == "user")).all()
    counts: dict[int, int] = defaultdict(int)
    for r in reports:
        counts[r.target_id] += 1
    for uid, n in counts.items():
        if n >= 2 and (u := db.get(User, uid)):
            flag(u, "reported", 2, f"reported by {n} people")

    return sorted(entries.values(), key=lambda e: e.score, reverse=True)
