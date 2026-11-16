from datetime import timedelta

from app.db.session import utcnow
from app.models import Listing
from tests.conftest import make_user

LAPTOP = {"title": "Working laptop", "category": "electronics", "quantity": 1, "condition": "good",
          "city": "Bengaluru", "area": "Koramangala", "original_price_inr": 40000}


def age_listing(db_session, listing_id: int, hours: float) -> None:
    """Move a listing back in time so it reaches a later lifecycle stage."""
    db = db_session()
    l = db.get(Listing, listing_id)
    delta = timedelta(hours=hours)
    l.priority_until -= delta
    l.marketplace_until -= delta
    l.created_at -= delta
    db.commit()
    db.close()


def test_new_listing_starts_free_with_suggested_price(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    res = donor.post("/api/listings", json=LAPTOP)
    assert res.status_code == 201
    body = res.json()
    assert body["stage"] == "free"
    assert body["unit"] == "items"
    assert body["price_inr"] == 18000  # 45% of 40,000 for "good"
    assert body["is_owner"] and not body["can_claim"]


def test_volunteers_cannot_list(new_client):
    vol = make_user(new_client, "volunteer", "v@example.com")
    assert vol.post("/api/listings", json=LAPTOP).status_code == 403


def test_food_requires_best_before(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    food = {**LAPTOP, "title": "Biryani", "category": "food", "original_price_inr": None}
    assert donor.post("/api/listings", json=food).status_code == 422
    best_before = (utcnow() + timedelta(hours=5)).isoformat() + "Z"
    res = donor.post("/api/listings", json={**food, "best_before": best_before})
    assert res.status_code == 201
    assert res.json()["stage"] == "free"


def test_free_stage_is_for_ngos_and_individuals_only(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "ngo@example.com")
    business = make_user(new_client, "business", "b@example.com")
    lid = donor.post("/api/listings", json=LAPTOP).json()["id"]

    view = business.get(f"/api/listings/{lid}").json()
    assert not view["can_claim"] and "NGOs" in view["claim_blocked_reason"]
    assert business.post(f"/api/listings/{lid}/claims", json={}).status_code == 409

    assert ngo.post(f"/api/listings/{lid}/claims", json={"message": "For our school"}).status_code == 201
    assert ngo.post(f"/api/listings/{lid}/claims", json={}).status_code == 409  # no duplicates


def test_marketplace_then_recycle_stages(new_client, db_session):
    donor = make_user(new_client, "donor", "d@example.com")
    business = make_user(new_client, "business", "b@example.com")
    recycler = make_user(new_client, "recycler", "r@example.com")
    lid = donor.post("/api/listings", json=LAPTOP).json()["id"]

    age_listing(db_session, lid, hours=24 * 8)  # past the 7-day electronics window
    assert business.get(f"/api/listings/{lid}").json()["stage"] == "marketplace"
    assert business.get(f"/api/listings/{lid}").json()["can_claim"]

    age_listing(db_session, lid, hours=24 * 15)  # past the 14-day marketplace window
    view = business.get(f"/api/listings/{lid}").json()
    assert view["stage"] == "recycle" and not view["can_claim"]
    assert recycler.post(f"/api/listings/{lid}/claims", json={}).status_code == 201


def test_stage_filter_in_browse(new_client, db_session):
    donor = make_user(new_client, "donor", "d@example.com")
    a = donor.post("/api/listings", json=LAPTOP).json()["id"]
    donor.post("/api/listings", json={**LAPTOP, "title": "Second laptop"})
    age_listing(db_session, a, hours=24 * 8)
    free = donor.get("/api/listings?stage=free").json()
    market = donor.get("/api/listings?stage=marketplace").json()
    assert free["total"] == 1 and market["total"] == 1
    assert market["items"][0]["id"] == a


def test_accept_then_complete_handover(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "ngo@example.com")
    ngo2 = make_user(new_client, "organisation", "ngo2@example.com")
    lid = donor.post("/api/listings", json=LAPTOP).json()["id"]
    c1 = ngo.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    c2 = ngo2.post(f"/api/listings/{lid}/claims", json={}).json()["id"]

    assert ngo.post(f"/api/claims/{c1}/accept").status_code == 403  # only the donor
    assert donor.post(f"/api/claims/{c1}/accept").json()["status"] == "accepted"
    statuses = {c["id"]: c["status"] for c in donor.get(f"/api/listings/{lid}/claims").json()}
    assert statuses == {c1: "accepted", c2: "declined"}
    assert donor.get("/api/listings").json()["total"] == 0  # reserved items leave the browse list

    assert donor.post(f"/api/claims/{c1}/complete").json()["status"] == "completed"
    assert donor.get(f"/api/listings/{lid}").json()["status"] == "completed"
    assert ngo.get("/api/me/claims").json()[0]["listing_title"] == "Working laptop"


def test_cancelling_accepted_claim_reopens_listing(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "ngo@example.com")
    lid = donor.post("/api/listings", json=LAPTOP).json()["id"]
    cid = ngo.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    donor.post(f"/api/claims/{cid}/accept")
    assert ngo.post(f"/api/claims/{cid}/cancel").json()["status"] == "cancelled"
    assert donor.get(f"/api/listings/{lid}").json()["status"] == "active"


def test_individual_free_claim_limit(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    person = make_user(new_client, "individual", "p@example.com")
    ids = [donor.post("/api/listings", json={**LAPTOP, "title": f"Laptop {i}"}).json()["id"] for i in range(4)]
    for lid in ids[:3]:
        assert person.post(f"/api/listings/{lid}/claims", json={}).status_code == 201
    res = person.post(f"/api/listings/{ids[3]}/claims", json={})
    assert res.status_code == 409 and "up to 3" in res.json()["detail"]


def test_withdraw_hides_listing(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    other = make_user(new_client, "individual", "p@example.com")
    lid = donor.post("/api/listings", json=LAPTOP).json()["id"]
    assert other.delete(f"/api/listings/{lid}").status_code == 403
    assert donor.delete(f"/api/listings/{lid}").status_code == 204
    assert other.get(f"/api/listings/{lid}").status_code == 404
