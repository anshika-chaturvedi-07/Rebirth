"""Payments for marketplace items.

Two interchangeable providers:
  * MockProvider (default): a simulated UPI checkout so the whole flow works locally with no keys.
  * RazorpayProvider: real Razorpay *test mode* when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set.
    Orders are created through Razorpay's Orders API; the browser opens Razorpay Checkout; the server verifies
    the HMAC-SHA256 signature before trusting a payment.
No card, UPI or bank details ever touch REBIRTH's servers — the provider handles them.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

PLATFORM_FEE_RATE = 0.05  # 5% commission on marketplace sales; free items never pay anything


@dataclass(frozen=True)
class Order:
    provider: str
    order_id: str
    amount_inr: int
    key_id: str | None = None  # public key for Razorpay Checkout


class PaymentError(Exception):
    pass


def split(amount_inr: int) -> tuple[int, int]:
    """(platform fee, donor payout), rounded to whole rupees with the payout getting any remainder."""
    fee = round(amount_inr * PLATFORM_FEE_RATE)
    return fee, amount_inr - fee


class MockProvider:
    name = "mock"
    _SECRET = b"rebirth-mock-provider"  # only signs simulated payments; not a real credential

    def create_order(self, amount_inr: int, receipt: str) -> Order:
        return Order(self.name, f"order_mock_{secrets.token_hex(8)}", amount_inr)

    def sign(self, order_id: str, payment_id: str) -> str:
        return hmac.new(self._SECRET, f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()

    def verify(self, order_id: str, payment_id: str, signature: str) -> bool:
        return hmac.compare_digest(self.sign(order_id, payment_id), signature)

    def refund(self, payment_id: str, amount_inr: int) -> None:
        return None


class RazorpayProvider:
    """Razorpay test mode. https://razorpay.com/docs/api/orders/ and payment signature verification."""

    name = "razorpay"
    API = "https://api.razorpay.com/v1"

    def __init__(self, key_id: str, key_secret: str):
        if not key_id.startswith("rzp_test_"):
            raise PaymentError("Only Razorpay *test* keys (rzp_test_…) are allowed in this project.")
        self.key_id, self._secret = key_id, key_secret

    def create_order(self, amount_inr: int, receipt: str) -> Order:
        res = httpx.post(f"{self.API}/orders", auth=(self.key_id, self._secret), timeout=15,
                         json={"amount": amount_inr * 100, "currency": "INR", "receipt": receipt})
        if res.status_code >= 400:
            raise PaymentError("Razorpay couldn't create the order. Check the test keys.")
        return Order(self.name, res.json()["id"], amount_inr, self.key_id)

    def verify(self, order_id: str, payment_id: str, signature: str) -> bool:
        expected = hmac.new(self._secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def refund(self, payment_id: str, amount_inr: int) -> None:
        res = httpx.post(f"{self.API}/payments/{payment_id}/refund", auth=(self.key_id, self._secret), timeout=15,
                         json={"amount": amount_inr * 100})
        if res.status_code >= 400:
            raise PaymentError("Razorpay couldn't refund this payment.")


def get_provider():
    s = get_settings()
    if s.razorpay_key_id and s.razorpay_key_secret:
        return RazorpayProvider(s.razorpay_key_id, s.razorpay_key_secret)
    return MockProvider()
