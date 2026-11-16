"""Database models.

Lifecycle of a listing (the hybrid model):
  free (priority window, NGOs & people in need)  ->  marketplace (low price, anyone)
  -> recycle (repairers & recyclers)   — or `expired` for perishables such as food.
The stage is derived from timestamps (priority_until, marketplace_until), so no background job is needed.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base, utcnow


class Role(StrEnum):
    donor = "donor"
    organisation = "organisation"
    individual = "individual"
    volunteer = "volunteer"
    business = "business"
    recycler = "recycler"
    admin = "admin"


class ListingStatus(StrEnum):
    active = "active"        # open — stage decided by time
    reserved = "reserved"    # donor accepted a claim, handover pending
    completed = "completed"  # handed over
    withdrawn = "withdrawn"  # donor removed it


class Stage(StrEnum):
    free = "free"
    marketplace = "marketplace"
    recycle = "recycle"
    expired = "expired"


class Condition(StrEnum):
    new = "new"
    good = "good"
    fair = "fair"
    needs_repair = "needs_repair"


class ClaimStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    completed = "completed"
    cancelled = "cancelled"


class NeedStatus(StrEnum):
    open = "open"
    fulfilled = "fulfilled"
    closed = "closed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    city: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    # Organisations must be verified (registration documents) — the review flow arrives with trust & safety.
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    listings: Mapped[list["Listing"]] = relationship(back_populates="donor")


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (Index("ix_listings_lat_lng", "lat", "lng"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), index=True)
    subcategory: Mapped[str | None] = mapped_column(String(60), nullable=True)
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(10))
    condition: Mapped[str] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(80), index=True)
    area: Mapped[str] = mapped_column(String(120), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_price_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)  # marketplace price
    status: Mapped[str] = mapped_column(String(20), default=ListingStatus.active, index=True)
    priority_until: Mapped[datetime] = mapped_column(DateTime, index=True)
    marketplace_until: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    donor: Mapped[User] = relationship(back_populates="listings")
    claims: Mapped[list["Claim"]] = relationship(back_populates="listing", order_by="Claim.created_at")


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    claimant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    stage: Mapped[str] = mapped_column(String(20))  # stage when claimed: free / marketplace / recycle
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=ClaimStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    listing: Mapped[Listing] = relationship(back_populates="claims")
    claimant: Mapped[User] = relationship()


class Need(Base):
    __tablename__ = "needs"
    __table_args__ = (Index("ix_needs_lat_lng", "lat", "lng"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(10))
    urgency: Mapped[int] = mapped_column(Integer, default=2)  # 1 low · 2 medium · 3 urgent
    city: Mapped[str] = mapped_column(String(80), index=True)
    area: Mapped[str] = mapped_column(String(120), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    needed_by: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=NeedStatus.open, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    requester: Mapped[User] = relationship()
