import re
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator

from app.data.categories import CATEGORY_BY_SLUG

# Datetimes are stored as naive UTC; send them to clients with an explicit UTC offset.
UTCDateTime = Annotated[datetime, PlainSerializer(lambda d: d.replace(tzinfo=UTC).isoformat(), return_type=str)]

PublicRole = Literal["donor", "organisation", "individual", "volunteer", "business", "recycler"]
ConditionLit = Literal["new", "good", "fair", "needs_repair"]
StageLit = Literal["free", "marketplace", "recycle", "expired"]

INDIAN_MOBILE = re.compile(r"^(?:\+91)?[6-9]\d{9}$")


def normalise_phone(v: str | None) -> str | None:
    if v is None or not v.strip():
        return None
    digits = re.sub(r"[\s-]", "", v)
    if not INDIAN_MOBILE.match(digits):
        raise ValueError("Enter a 10-digit Indian mobile number.")
    return "+91" + digits[-10:]


def check_category(v: str) -> str:
    if v not in CATEGORY_BY_SLUG:
        raise ValueError(f"Unknown category '{v}'.")
    return v


# ---------- auth ----------
class RegisterIn(BaseModel):
    role: PublicRole
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = None
    city: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=72)  # bcrypt uses the first 72 bytes

    _phone = field_validator("phone")(normalise_phone)


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, description="Email or Indian mobile number")
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    name: str
    email: str
    phone: str | None
    city: str
    verified: bool
    created_at: UTCDateTime


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    role: str
    verified: bool


# ---------- listings ----------
class ListingIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=2000)
    category: str
    subcategory: str | None = Field(default=None, max_length=60)
    quantity: float = Field(gt=0, le=100000)
    condition: ConditionLit = "good"
    city: str = Field(min_length=2, max_length=80)
    area: str = Field(default="", max_length=120)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    original_price_inr: int | None = Field(default=None, ge=0, le=10_000_000)
    best_before: datetime | None = Field(default=None, description="Required for perishables such as food")
    photo_ids: list[int] = Field(default_factory=list, max_length=4)

    _category = field_validator("category")(check_category)

    @field_validator("best_before")
    @classmethod
    def to_naive_utc(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is not None:
            v = v.astimezone(UTC).replace(tzinfo=None)
        return v


class ListingOut(BaseModel):
    id: int
    title: str
    description: str
    category: str
    subcategory: str | None
    quantity: float
    unit: str
    condition: str
    city: str
    area: str
    lat: float | None
    lng: float | None
    location_exact: bool = False  # False: rounded to ~100 m for privacy
    photos: list[str] = []
    distance_km: float | None = None  # set when searching near a point
    price_inr: int | None
    status: str
    stage: StageLit
    stage_ends_at: UTCDateTime | None
    priority_until: UTCDateTime
    marketplace_until: UTCDateTime
    created_at: UTCDateTime
    donor: UserBrief
    claim_count: int
    # viewer-specific
    is_owner: bool = False
    my_claim_id: int | None = None
    my_claim_status: str | None = None
    can_claim: bool = False
    claim_blocked_reason: str | None = None


class ListingPage(BaseModel):
    items: list[ListingOut]
    total: int


# ---------- claims ----------
class ClaimIn(BaseModel):
    message: str = Field(default="", max_length=500)


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    listing_id: int
    stage: str
    message: str
    status: str
    created_at: UTCDateTime
    claimant: UserBrief


class MyClaimOut(ClaimOut):
    listing_title: str
    listing_category: str


# ---------- needs ----------
class NeedIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=2000)
    category: str
    quantity: float = Field(gt=0, le=100000)
    urgency: int = Field(default=2, ge=1, le=3)
    city: str = Field(min_length=2, max_length=80)
    area: str = Field(default="", max_length=120)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    needed_by: datetime | None = None

    _category = field_validator("category")(check_category)

    @field_validator("needed_by")
    @classmethod
    def to_naive_utc(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is not None:
            v = v.astimezone(UTC).replace(tzinfo=None)
        return v


class NeedStatusIn(BaseModel):
    status: Literal["open", "fulfilled", "closed"]


class NeedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    category: str
    quantity: float
    unit: str
    urgency: int
    city: str
    area: str
    lat: float | None
    lng: float | None
    location_exact: bool = False
    distance_km: float | None = None
    needed_by: UTCDateTime | None
    status: str
    created_at: UTCDateTime
    requester: UserBrief
