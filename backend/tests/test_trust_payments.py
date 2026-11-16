import hashlib
import hmac
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import utcnow
from app.main import app
from app.models import Listing, User
from app.services.community import display_name
from app.services.payments import PaymentError, RazorpayProvider, split
from tests.conftest import make_user

CHAIRS = {"title": "Office chairs", "category": "furniture", "quantity": 4, "city": "Bengaluru",
          "area": "Koramangala", "original_price_inr": 6000}


def make_admin(db_session) -> TestClient:
    db = db_session()
    db.add(User(role="admin", name="Admin", email="admin@example.com", city="Bengaluru", password_hash=hash_password("password123")))
    db.commit()
    db.close()
    c = TestClient(app)
    assert c.post("/api/auth/login", json={"identifier": "admin@example.com", "password": "password123"}).status_code == 200
    return c


def to_marketplace(db_session, listing_id: int) -> None:
    db = db_session()
    l = db.get(Listing, listing_id)
    l.priority_until = utcnow() - timedelta(hours=1)
    db.commit()
    db.close()


def accepted_marketplace_claim(new_client, db_session):
    donor = make_user(new_client, "donor", "d@example.com")
    buyer = make_user(new_client, "individual", "b@example.com")
    lid = donor.post("/api/listings", json=CHAIRS).json()["id"]
    to_marketplace(db_session, lid)
    cid = buyer.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    donor.post(f"/api/claims/{cid}/accept")
    return donor, buyer, lid, cid


# ---------------------------------------------------------------- payments
def test_fee_split():
    assert split(2700) == (135, 2565)
    assert sum(split(999)) == 999


def test_marketplace_purchase_must_be_paid_before_handover(new_client, db_session):
    donor, buyer, lid, cid = accepted_marketplace_claim(new_client, db_session)
    assert donor.post(f"/api/claims/{cid}/complete").status_code == 409  # not paid yet

    order = buyer.post(f"/api/claims/{cid}/pay").json()
    assert order["provider"] == "mock" and order["amount_inr"] == 2700  # 45% of ₹6,000 for "good"
    assert order["fee_inr"] + order["payout_inr"] == 2700

    # a forged signature is rejected and the attempt is marked failed
    bad = buyer.post(f"/api/payments/{order['payment_id']}/confirm", json={"provider_payment_id": "pay_fake_1", "signature": "0" * 64})
    assert bad.status_code == 400

    order2 = buyer.post(f"/api/claims/{cid}/pay").json()
    proof = buyer.post(f"/api/payments/{order2['payment_id']}/simulate").json()
    paid = buyer.post(f"/api/payments/{order2['payment_id']}/confirm", json=proof).json()
    assert paid["status"] == "paid"
    assert buyer.get(f"/api/listings/{lid}").json()["my_payment_status"] == "paid"
    assert buyer.post(f"/api/claims/{cid}/pay").status_code == 409  # no double payment
    assert donor.post(f"/api/claims/{cid}/complete").json()["status"] == "completed"


def test_cancelling_after_payment_refunds(new_client, db_session):
    donor, buyer, lid, cid = accepted_marketplace_claim(new_client, db_session)
    order = buyer.post(f"/api/claims/{cid}/pay").json()
    buyer.post(f"/api/payments/{order['payment_id']}/confirm", json=buyer.post(f"/api/payments/{order['payment_id']}/simulate").json())
    buyer.post(f"/api/claims/{cid}/cancel")
    assert buyer.get(f"/api/claims/{cid}/payment").json()["status"] == "refunded"


def test_only_the_buyer_can_pay_and_free_items_cannot_be_paid(new_client, db_session):
    donor, buyer, lid, cid = accepted_marketplace_claim(new_client, db_session)
    assert donor.post(f"/api/claims/{cid}/pay").status_code == 404
    ngo = make_user(new_client, "organisation", "n@example.com")
    free_lid = donor.post("/api/listings", json={**CHAIRS, "title": "Free chairs"}).json()["id"]
    free_cid = ngo.post(f"/api/listings/{free_lid}/claims", json={}).json()["id"]
    donor.post(f"/api/claims/{free_cid}/accept")
    assert ngo.post(f"/api/claims/{free_cid}/pay").status_code == 409


def test_razorpay_signature_and_test_keys_only():
    with pytest.raises(PaymentError):
        RazorpayProvider("rzp_live_abc", "secret")
    p = RazorpayProvider("rzp_test_abc", "test_secret")
    sig = hmac.new(b"test_secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
    assert p.verify("order_1", "pay_1", sig)
    assert not p.verify("order_1", "pay_2", sig)


# ---------------------------------------------------------------- verification & admin
def test_verification_flow(new_client, db_session):
    ngo = make_user(new_client, "organisation", "n@example.com")
    donor = make_user(new_client, "donor", "d@example.com")
    admin = make_admin(db_session)

    assert donor.post("/api/verification", json={"kind": "darpan", "reference": "KA/2017/0123456"}).status_code == 403
    assert ngo.post("/api/verification", json={"kind": "darpan", "reference": "KA-17-123"}).status_code == 422
    req = ngo.post("/api/verification", json={"kind": "darpan", "reference": " ka/2017/0123456 "}).json()
    assert req["reference"] == "KA/2017/0123456" and req["status"] == "pending"
    assert ngo.post("/api/verification", json={"kind": "udise", "reference": "29200100101"}).status_code == 409

    assert ngo.post(f"/api/admin/verifications/{req['id']}/approve", json={}).status_code == 403
    assert [v["id"] for v in admin.get("/api/admin/verifications").json()] == [req["id"]]
    assert admin.post(f"/api/admin/verifications/{req['id']}/reject", json={"note": ""}).status_code == 422
    assert admin.post(f"/api/admin/verifications/{req['id']}/approve", json={"note": "ok"}).json()["status"] == "approved"
    assert ngo.get("/api/auth/me").json()["verified"] is True


def test_reports_and_admin_queue(new_client, db_session):
    donor = make_user(new_client, "donor", "d@example.com")
    other = make_user(new_client, "individual", "p@example.com")
    admin = make_admin(db_session)
    lid = donor.post("/api/listings", json=CHAIRS).json()["id"]
    r = other.post("/api/reports", json={"target_type": "listing", "target_id": lid, "reason": "misleading"}).json()
    assert r["target_label"] == "Office chairs"
    assert other.post("/api/reports", json={"target_type": "listing", "target_id": lid, "reason": "spam"}).status_code == 409
    me = other.get("/api/auth/me").json()["id"]
    assert other.post("/api/reports", json={"target_type": "user", "target_id": me, "reason": "spam"}).status_code == 422
    assert len(admin.get("/api/admin/reports").json()) == 1
    assert admin.post(f"/api/admin/reports/{r['id']}/resolve").json()["status"] == "resolved"
    assert admin.get("/api/admin/reports").json() == []


def test_risk_signals_flag_free_item_resale(new_client, db_session):
    donor = make_user(new_client, "donor", "d@example.com")
    person = make_user(new_client, "individual", "p@example.com")
    admin = make_admin(db_session)
    lid = donor.post("/api/listings", json={**CHAIRS, "original_price_inr": None}).json()["id"]
    cid = person.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    donor.post(f"/api/claims/{cid}/accept")
    donor.post(f"/api/claims/{cid}/complete")
    person.post("/api/listings", json={**CHAIRS, "title": "Chairs for sale"})  # same category, with a price
    flagged = admin.get("/api/admin/risk").json()
    assert flagged and flagged[0]["signals"][0]["code"] == "possible_resale"
    assert admin.get("/api/admin/overview").json()["handovers"] == 1


# ---------------------------------------------------------------- reviews, profile, badges, leaderboard, PDF
def test_reviews_after_handover_and_public_profile(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "n@example.com")
    lid = donor.post("/api/listings", json=CHAIRS).json()["id"]
    cid = ngo.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    donor.post(f"/api/claims/{cid}/accept")
    assert ngo.post(f"/api/claims/{cid}/review", json={"stars": 5}).status_code == 409  # not complete yet
    donor.post(f"/api/claims/{cid}/complete")

    assert ngo.get(f"/api/listings/{lid}").json()["review_claim_id"] == cid
    assert ngo.post(f"/api/claims/{cid}/review", json={"stars": 5, "comment": "Lovely chairs"}).status_code == 201
    assert ngo.post(f"/api/claims/{cid}/review", json={"stars": 4}).status_code == 409
    assert ngo.get(f"/api/listings/{lid}").json()["my_review_stars"] == 5

    donor_id = donor.get("/api/auth/me").json()["id"]
    prof = ngo.get(f"/api/users/{donor_id}/profile").json()
    assert prof["rating"] == {"average": 5.0, "count": 1}
    assert prof["handovers"]["given"] == 1
    assert "email" not in prof and "phone" not in prof
    assert prof["name"] == "Test d."  # people are shown as first name + last initial


def test_display_names_protect_people():
    assert display_name(User(role="individual", name="Aarav Kumar", email="", city="", password_hash="")) == "Aarav K."
    assert display_name(User(role="business", name="Brightlabs Software", email="", city="", password_hash="")) == "Brightlabs Software"


def test_badges_leaderboard_and_pdf(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "n@example.com")
    food = {"title": "Biryani trays", "category": "food", "quantity": 120, "city": "Bengaluru",
            "best_before": (utcnow() + timedelta(hours=3)).isoformat() + "Z"}
    lid = donor.post("/api/listings", json=food).json()["id"]
    cid = ngo.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    donor.post(f"/api/claims/{cid}/accept")
    donor.post(f"/api/claims/{cid}/complete")

    earned = {b["code"] for b in donor.get("/api/me/badges").json() if b["earned"]}
    assert {"first_gift", "food_hero"} <= earned and "climate_champion" not in earned  # 120 kg food = 300 kg CO2e

    board = donor.get("/api/leaderboard?days=30").json()
    assert [g["name"] for g in board["givers"]] == ["Test d."]
    assert all(g["role"] != "organisation" for g in board["givers"])  # receivers never ranked

    pdf = donor.get("/api/impact/me/report.pdf")
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
    assert pdf.content[:5] == b"%PDF-" and len(pdf.content) > 1500
    assert "attachment" in pdf.headers["content-disposition"]
