from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, require_roles
from app.db.session import utcnow
from app.models import (
    Claim, ClaimStatus, Listing, Need, Payment, PaymentStatus, Report, ReviewStatus, Role, User, VerificationRequest,
)
from app.schemas import UserBrief, UTCDateTime
from app.services.trust import normalise_reference, risk_signals

router = APIRouter(prefix="/api", tags=["trust & safety"])
Admin = Annotated[User, Depends(require_roles(Role.admin))]


# ---------------------------------------------------------------- verification
class VerificationIn(BaseModel):
    kind: Literal["darpan", "udise", "other"]
    reference: str = Field(min_length=4, max_length=40)
    note: str = Field(default="", max_length=500)


class VerificationOut(BaseModel):
    id: int
    kind: str
    reference: str
    note: str
    status: str
    review_note: str
    created_at: UTCDateTime
    reviewed_at: UTCDateTime | None
    user: UserBrief

    model_config = {"from_attributes": True}


class ReviewDecision(BaseModel):
    note: str = Field(default="", max_length=500)


@router.post("/verification", response_model=VerificationOut, status_code=status.HTTP_201_CREATED)
def request_verification(body: VerificationIn, db: DB,
                         user: Annotated[User, Depends(require_roles(Role.organisation))]) -> VerificationRequest:
    if user.verified:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your organisation is already verified.")
    if db.scalar(select(VerificationRequest.id).where(VerificationRequest.user_id == user.id,
                                                      VerificationRequest.status == ReviewStatus.pending)):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a request waiting for review.")
    try:
        ref = normalise_reference(body.kind, body.reference)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    taken = db.scalar(select(VerificationRequest.id).where(VerificationRequest.reference == ref,
                                                           VerificationRequest.status == ReviewStatus.approved))
    if taken:
        raise HTTPException(status.HTTP_409_CONFLICT, "Another organisation is already verified with this ID.")
    req = VerificationRequest(user_id=user.id, kind=body.kind, reference=ref, note=body.note.strip())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/verification/me", response_model=list[VerificationOut])
def my_verification(db: DB, user: CurrentUser) -> list[VerificationRequest]:
    return list(db.scalars(select(VerificationRequest).where(VerificationRequest.user_id == user.id)
                           .order_by(VerificationRequest.created_at.desc())).all())


@router.get("/admin/verifications", response_model=list[VerificationOut])
def list_verifications(db: DB, _: Admin, state: Literal["pending", "approved", "rejected"] = "pending") -> list[VerificationRequest]:
    return list(db.scalars(select(VerificationRequest).where(VerificationRequest.status == state)
                           .order_by(VerificationRequest.created_at)).all())


def _decide(db, req_id: int, admin: User, approve: bool, note: str) -> VerificationRequest:
    req = db.get(VerificationRequest, req_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    if req.status != ReviewStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been reviewed.")
    req.status = ReviewStatus.approved if approve else ReviewStatus.rejected
    req.reviewer_id, req.review_note, req.reviewed_at = admin.id, note.strip(), utcnow()
    if approve:
        req.user.verified = True
    db.commit()
    return req


@router.post("/admin/verifications/{req_id}/approve", response_model=VerificationOut)
def approve(req_id: int, body: ReviewDecision, db: DB, admin: Admin) -> VerificationRequest:
    return _decide(db, req_id, admin, True, body.note)


@router.post("/admin/verifications/{req_id}/reject", response_model=VerificationOut)
def reject(req_id: int, body: ReviewDecision, db: DB, admin: Admin) -> VerificationRequest:
    if not body.note.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tell the organisation why, so they can fix it.")
    return _decide(db, req_id, admin, False, body.note)


# ---------------------------------------------------------------- reports
ReportReason = Literal["spam", "unsafe", "misleading", "resale", "abuse", "other"]


class ReportIn(BaseModel):
    target_type: Literal["listing", "need", "user"]
    target_id: int
    reason: ReportReason
    details: str = Field(default="", max_length=1000)


class ReportOut(BaseModel):
    id: int
    target_type: str
    target_id: int
    target_label: str
    reason: str
    details: str
    status: str
    created_at: UTCDateTime
    reporter: UserBrief


def _target_label(db, kind: str, tid: int) -> str | None:
    model = {"listing": Listing, "need": Need, "user": User}[kind]
    obj = db.get(model, tid)
    if obj is None:
        return None
    return getattr(obj, "title", None) or getattr(obj, "name", "")


def _report_out(db, r: Report) -> ReportOut:
    return ReportOut(id=r.id, target_type=r.target_type, target_id=r.target_id,
                     target_label=_target_label(db, r.target_type, r.target_id) or "(removed)", reason=r.reason,
                     details=r.details, status=r.status, created_at=r.created_at, reporter=UserBrief.model_validate(r.reporter))


@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(body: ReportIn, db: DB, user: CurrentUser) -> ReportOut:
    if _target_label(db, body.target_type, body.target_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We couldn't find what you're reporting.")
    if body.target_type == "user" and body.target_id == user.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You can't report yourself.")
    dup = db.scalar(select(Report.id).where(Report.reporter_id == user.id, Report.target_type == body.target_type,
                                            Report.target_id == body.target_id, Report.status == "open"))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already reported this. Our team will look at it.")
    r = Report(reporter_id=user.id, target_type=body.target_type, target_id=body.target_id, reason=body.reason,
               details=body.details.strip())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _report_out(db, r)


@router.get("/admin/reports", response_model=list[ReportOut])
def list_reports(db: DB, _: Admin, state: Literal["open", "resolved", "dismissed"] = "open") -> list[ReportOut]:
    return [_report_out(db, r) for r in db.scalars(select(Report).where(Report.status == state).order_by(Report.created_at)).all()]


@router.post("/admin/reports/{report_id}/{action}", response_model=ReportOut)
def close_report(report_id: int, action: Literal["resolve", "dismiss"], db: DB, _: Admin) -> ReportOut:
    r = db.get(Report, report_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found.")
    r.status, r.resolved_at = ("resolved" if action == "resolve" else "dismissed"), utcnow()
    db.commit()
    return _report_out(db, r)


# ---------------------------------------------------------------- risk & overview
class RiskOut(BaseModel):
    user: UserBrief
    score: int
    signals: list[dict]


@router.get("/admin/risk", response_model=list[RiskOut])
def risk(db: DB, _: Admin) -> list[RiskOut]:
    return [RiskOut(user=UserBrief.model_validate(e.user), score=e.score, signals=e.signals) for e in risk_signals(db, utcnow())]


@router.get("/admin/overview")
def overview(db: DB, _: Admin) -> dict:
    gmv = db.scalar(select(func.coalesce(func.sum(Payment.amount_inr), 0)).where(Payment.status == PaymentStatus.paid))
    fees = db.scalar(select(func.coalesce(func.sum(Payment.fee_inr), 0)).where(Payment.status == PaymentStatus.paid))
    return {
        "users": db.scalar(select(func.count(User.id))),
        "pending_verifications": db.scalar(select(func.count(VerificationRequest.id)).where(VerificationRequest.status == ReviewStatus.pending)),
        "open_reports": db.scalar(select(func.count(Report.id)).where(Report.status == "open")),
        "handovers": db.scalar(select(func.count(Claim.id)).where(Claim.status == ClaimStatus.completed)),
        "marketplace_sales_inr": int(gmv or 0),
        "platform_fees_inr": int(fees or 0),
    }
