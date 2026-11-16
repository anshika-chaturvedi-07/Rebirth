import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.db.session import utcnow
from app.models import Claim, ClaimStatus, Payment, PaymentStatus, Stage
from app.services.payments import MockProvider, PaymentError, get_provider, split

router = APIRouter(prefix="/api", tags=["payments"])


class OrderOut(BaseModel):
    payment_id: int
    provider: str
    order_id: str
    amount_inr: int
    fee_inr: int
    payout_inr: int
    key_id: str | None = None
    item: str


class ConfirmIn(BaseModel):
    provider_payment_id: str = Field(min_length=4, max_length=80)
    signature: str = Field(min_length=16, max_length=200)


class PaymentOut(BaseModel):
    id: int
    status: str
    amount_inr: int
    provider: str
    provider_payment_id: str | None


def paid_payment(claim: Claim) -> Payment | None:
    return next((p for p in claim.payments if p.status == PaymentStatus.paid), None)


def needs_payment(claim: Claim) -> bool:
    return claim.stage == Stage.marketplace and bool(claim.listing.price_inr)


@router.post("/claims/{claim_id}/pay", response_model=OrderOut)
def start_payment(claim_id: int, db: DB, user: CurrentUser) -> OrderOut:
    claim = db.get(Claim, claim_id)
    if claim is None or claim.claimant_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    if not needs_payment(claim):
        raise HTTPException(status.HTTP_409_CONFLICT, "This item is free, so there's nothing to pay.")
    if claim.status != ClaimStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can pay once the donor accepts your request.")
    if paid_payment(claim):
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already paid for this item.")
    amount = int(claim.listing.price_inr)
    provider = get_provider()
    try:
        order = provider.create_order(amount, receipt=f"claim-{claim.id}")
    except PaymentError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
    fee, payout = split(amount)
    payment = Payment(claim_id=claim.id, payer_id=user.id, amount_inr=amount, fee_inr=fee, payout_inr=payout,
                      provider=order.provider, provider_order_id=order.order_id)
    db.add(payment)
    db.commit()
    return OrderOut(payment_id=payment.id, provider=order.provider, order_id=order.order_id, amount_inr=amount,
                    fee_inr=fee, payout_inr=payout, key_id=order.key_id, item=claim.listing.title)


@router.post("/payments/{payment_id}/simulate", response_model=ConfirmIn)
def simulate_checkout(payment_id: int, db: DB, user: CurrentUser) -> ConfirmIn:
    """The built-in test checkout: produce what a payment provider would hand back after a successful UPI payment."""
    payment = db.get(Payment, payment_id)
    if payment is None or payment.payer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found.")
    if payment.provider != "mock":
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment uses Razorpay Checkout, not the simulator.")
    pay_id = f"pay_mock_{secrets.token_hex(8)}"
    return ConfirmIn(provider_payment_id=pay_id, signature=MockProvider().sign(payment.provider_order_id, pay_id))


@router.post("/payments/{payment_id}/confirm", response_model=PaymentOut)
def confirm_payment(payment_id: int, body: ConfirmIn, db: DB, user: CurrentUser) -> Payment:
    """Trust a payment only after verifying the provider's signature over order id + payment id."""
    payment = db.get(Payment, payment_id)
    if payment is None or payment.payer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found.")
    if payment.status == PaymentStatus.paid:
        return payment
    provider = get_provider() if payment.provider == "razorpay" else MockProvider()
    if not provider.verify(payment.provider_order_id, body.provider_payment_id, body.signature):
        payment.status = PaymentStatus.failed
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "We couldn't verify this payment, so it wasn't accepted.")
    payment.status, payment.provider_payment_id, payment.paid_at = PaymentStatus.paid, body.provider_payment_id, utcnow()
    db.commit()
    return payment


@router.get("/claims/{claim_id}/payment", response_model=PaymentOut | None)
def claim_payment(claim_id: int, db: DB, user: CurrentUser) -> Payment | None:
    claim = db.get(Claim, claim_id)
    if claim is None or user.id not in (claim.claimant_id, claim.listing.donor_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    return db.scalar(select(Payment).where(Payment.claim_id == claim_id).order_by(Payment.created_at.desc()))


def refund_if_paid(claim: Claim) -> None:
    """Called when a paid request is cancelled: refund through the same provider."""
    payment = paid_payment(claim)
    if payment is None:
        return
    provider = get_provider() if payment.provider == "razorpay" else MockProvider()
    provider.refund(payment.provider_payment_id or "", payment.amount_inr)
    payment.status, payment.refunded_at = PaymentStatus.refunded, utcnow()
