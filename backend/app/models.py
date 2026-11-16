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


class DeliveryStatus(StrEnum):
    open = "open"            # waiting for a volunteer
    assigned = "assigned"    # a volunteer took it
    picked_up = "picked_up"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentStatus(StrEnum):
    created = "created"    # order created, waiting for the buyer
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class ReviewStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


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
    photos: Mapped[list["Photo"]] = relationship(back_populates="listing", order_by="Photo.position")


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    claimant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    stage: Mapped[str] = mapped_column(String(20))  # stage when claimed: free / marketplace / recycle
    message: Mapped[str] = mapped_column(Text, default="")
    need_id: Mapped[int | None] = mapped_column(ForeignKey("needs.id"), nullable=True, index=True)  # which need it's for
    wants_delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default=ClaimStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    listing: Mapped[Listing] = relationship(back_populates="claims")
    claimant: Mapped[User] = relationship()
    need: Mapped["Need | None"] = relationship()
    delivery: Mapped["DeliveryTask | None"] = relationship(back_populates="claim", uselist=False)

    payments: Mapped[list["Payment"]] = relationship(back_populates="claim", order_by="Payment.created_at")

    @property
    def delivery_status(self) -> str | None:
        return self.delivery.status if self.delivery is not None else None

    @property
    def payment_status(self) -> str | None:
        """paid > created > refunded/failed; None when nothing was ever started."""
        if not self.payments:
            return None
        statuses = {p.status for p in self.payments}
        for s in (PaymentStatus.paid, PaymentStatus.created, PaymentStatus.refunded, PaymentStatus.failed):
            if s in statuses:
                return s
        return None


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


class Photo(Base):
    """An uploaded image. Re-encoded on upload (EXIF, including GPS, is stripped); attached to a listing later."""

    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    listing_id: Mapped[int | None] = mapped_column(ForeignKey("listings.id"), index=True, nullable=True)
    filename: Mapped[str] = mapped_column(String(80), unique=True)
    external_url: Mapped[str | None] = mapped_column(String(400), nullable=True)  # set when stored on Cloudinary
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    listing: Mapped[Listing | None] = relationship(back_populates="photos")

    @property
    def url(self) -> str:
        return self.external_url or f"/media/{self.filename}"


class DeliveryTask(Base):
    """A pickup-and-drop-off job for volunteers, created when a donor accepts a request that asked for delivery."""

    __tablename__ = "delivery_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), unique=True)
    volunteer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default=DeliveryStatus.open, index=True)
    pickup_lat: Mapped[float] = mapped_column(Float)
    pickup_lng: Mapped[float] = mapped_column(Float)
    pickup_label: Mapped[str] = mapped_column(String(160))
    dropoff_lat: Mapped[float] = mapped_column(Float)
    dropoff_lng: Mapped[float] = mapped_column(Float)
    dropoff_label: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    claim: Mapped[Claim] = relationship(back_populates="delivery")
    volunteer: Mapped[User | None] = relationship()


class Payment(Base):
    """Payment for a marketplace request. The platform keeps a small commission; the rest is the donor's payout."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), index=True)
    payer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount_inr: Mapped[int] = mapped_column(Integer)
    fee_inr: Mapped[int] = mapped_column(Integer)          # platform commission
    payout_inr: Mapped[int] = mapped_column(Integer)       # to the donor
    provider: Mapped[str] = mapped_column(String(20))      # "mock" | "razorpay"
    provider_order_id: Mapped[str] = mapped_column(String(80), unique=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=PaymentStatus.created, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    claim: Mapped[Claim] = relationship(back_populates="payments")


class VerificationRequest(Base):
    """An organisation asks to be verified with its NGO Darpan ID or school UDISE code; an admin reviews it."""

    __tablename__ = "verification_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # "darpan" | "udise" | "other"
    reference: Mapped[str] = mapped_column(String(40))
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=ReviewStatus.pending, index=True)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id])


class Review(Base):
    """After a completed handover, each side can rate the other once."""

    __tablename__ = "reviews"
    __table_args__ = (Index("uq_reviews_claim_author", "claim_id", "author_id", unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    stars: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    author: Mapped[User] = relationship(foreign_keys=[author_id])


class Report(Base):
    """A user flags a listing, need or user for an admin to look at."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[str] = mapped_column(String(20))  # "listing" | "need" | "user"
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    reason: Mapped[str] = mapped_column(String(40))
    details: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | resolved | dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    reporter: Mapped[User] = relationship()
