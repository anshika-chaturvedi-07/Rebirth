from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.db.session import utcnow
from app.models import Claim, ClaimStatus, Listing, Review, Role, User
from app.schemas import UTCDateTime
from app.services import community, impact, report_pdf

router = APIRouter(prefix="/api", tags=["community"])


class ReviewIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


class ReviewOut(BaseModel):
    id: int
    stars: int
    comment: str
    created_at: UTCDateTime
    author_name: str
    author_role: str


def _review_out(r: Review) -> ReviewOut:
    return ReviewOut(id=r.id, stars=r.stars, comment=r.comment, created_at=r.created_at,
                     author_name=community.display_name(r.author), author_role=r.author.role)


@router.post("/claims/{claim_id}/review", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def review(claim_id: int, body: ReviewIn, db: DB, user: CurrentUser) -> ReviewOut:
    claim = db.get(Claim, claim_id)
    if claim is None or user.id not in (claim.claimant_id, claim.listing.donor_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    if claim.status != ClaimStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can leave a review once the handover is complete.")
    if db.scalar(select(Review.id).where(Review.claim_id == claim.id, Review.author_id == user.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already reviewed this handover.")
    subject = claim.listing.donor_id if user.id == claim.claimant_id else claim.claimant_id
    r = Review(claim_id=claim.id, author_id=user.id, subject_id=subject, stars=body.stars, comment=body.comment.strip())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _review_out(r)


@router.get("/users/{user_id}/profile")
def profile(user_id: int, db: DB) -> dict:
    """Public profile: no email or phone, people shown as first name + initial."""
    u = db.get(User, user_id)
    if u is None or u.role == Role.admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
    avg, n = community.rating(db, u.id)
    given = db.scalar(select(func.count(Claim.id)).join(Listing, Claim.listing_id == Listing.id)
                      .where(Listing.donor_id == u.id, Claim.status == ClaimStatus.completed)) or 0
    received = db.scalar(select(func.count(Claim.id)).where(Claim.claimant_id == u.id, Claim.status == ClaimStatus.completed)) or 0
    reviews = db.scalars(select(Review).where(Review.subject_id == u.id).order_by(Review.created_at.desc()).limit(6)).all()
    return {
        "id": u.id, "name": community.display_name(u), "role": u.role, "verified": u.verified, "city": u.city,
        "member_since": u.created_at.isoformat() + "Z",
        "rating": {"average": avg, "count": n},
        "handovers": {"given": given, "received": received},
        "badges": [b for b in community.badges(db, u) if b["earned"]],
        "reviews": [_review_out(r).model_dump(mode="json") for r in reviews],
    }


@router.get("/me/badges")
def my_badges(db: DB, user: CurrentUser) -> list[dict]:
    return community.badges(db, user)


@router.get("/leaderboard")
def leaderboard(db: DB, days: Annotated[int, Query(ge=7, le=365)] = 90) -> dict:
    return community.leaderboard(db, utcnow(), days)


@router.get("/impact/me/report.pdf")
def impact_report(db: DB, user: CurrentUser, scope: Literal["given", "received", "delivered"] = "given") -> Response:
    """Download a PDF impact report (for CSR teams, NGOs' annual reports or personal records)."""
    now = utcnow()
    data = impact.user_impact(db, user.id, now)[scope]
    demo = db.scalar(select(func.count(Listing.id)).where(Listing.description == "Simulated history (demo data).")) > 0
    pdf = report_pdf.build(user.name, user.role, user.verified, f"Last 12 months · {scope}", data, now, demo)
    safe = "".join(ch for ch in user.name if ch.isalnum() or ch in " -_").strip().replace(" ", "-")[:40] or "rebirth"
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="REBIRTH-impact-{safe}-{now:%Y-%m}.pdf"'})
