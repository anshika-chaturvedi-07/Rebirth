from datetime import timedelta

from app.db.session import utcnow
from app.models import Listing
from app.services.matching import tokens
from tests.conftest import make_user

KORAMANGALA = {"area": "Koramangala", "city": "Bengaluru"}
WHITEFIELD = {"area": "Whitefield", "city": "Bengaluru"}  # ~13 km from Koramangala
YELAHANKA = {"area": "Yelahanka", "city": "Bengaluru"}    # ~19 km


def listing(client, title, category="furniture", qty=10, **where):
    body = {"title": title, "category": category, "quantity": qty, **(where or KORAMANGALA)}
    res = client.post("/api/listings", json=body)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def need(client, title, category="furniture", qty=10, urgency=2, **where):
    body = {"title": title, "category": category, "quantity": qty, "urgency": urgency, **(where or KORAMANGALA)}
    res = client.post("/api/needs", json=body)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_tokens_stem_and_drop_stopwords():
    assert tokens("Chairs for two new classrooms") == {"chair", "classroom"}
    assert tokens("Blankets & bedsheets") == {"blanket", "bedsheet"}


def test_needs_for_a_listing_are_ranked_and_explained(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    school = make_user(new_client, "organisation", "s@example.com")
    shelter = make_user(new_client, "organisation", "h@example.com")
    lid = listing(donor, "Classroom chairs", qty=20)

    near_relevant = need(school, "Chairs for classrooms", qty=20, urgency=3)
    far_vague = need(shelter, "Beds", qty=5, urgency=1, **YELAHANKA)
    need(shelter, "Winter blankets", category="clothing")  # other category: never matched

    matches = donor.get(f"/api/listings/{lid}/matches").json()
    assert [m["need"]["id"] for m in matches] == [near_relevant, far_vague]
    top = matches[0]
    assert top["score"] > matches[1]["score"]
    assert "Urgent need" in top["reasons"] and "Covers the whole need" in top["reasons"]
    assert any(r.startswith("Matches") and "chair" in r for r in top["reasons"])
    assert set(top["components"]) == {"distance", "relevance", "urgency", "coverage", "cost", "time", "trust"}


def test_listings_for_a_need_skip_own_items_and_closed_items(new_client, db_session):
    school = make_user(new_client, "organisation", "s@example.com")
    donor = make_user(new_client, "donor", "d@example.com")
    nid = need(school, "Office desks", qty=4)
    good = listing(donor, "Wooden office desks", qty=4)
    far = listing(donor, "Desk", qty=1, **WHITEFIELD)
    own = listing(school, "Our spare desks", qty=4)  # schools can list too, but never match themselves
    gone = listing(donor, "Desks (taken)", qty=4)
    donor.delete(f"/api/listings/{gone}")

    ids = [m["listing"]["id"] for m in school.get(f"/api/needs/{nid}/matches").json()]
    assert ids[0] == good and far in ids
    assert own not in ids and gone not in ids


def test_recycle_stage_items_are_not_suggested(new_client, db_session):
    school = make_user(new_client, "organisation", "s@example.com")
    donor = make_user(new_client, "donor", "d@example.com")
    nid = need(school, "Chairs")
    lid = listing(donor, "Chairs")
    db = db_session()
    l = db.get(Listing, lid)
    l.priority_until = l.marketplace_until = utcnow() - timedelta(hours=1)  # now in the recycle stage
    db.commit()
    db.close()
    assert school.get(f"/api/needs/{nid}/matches").json() == []


def test_personal_suggestions_feed(new_client):
    school = make_user(new_client, "organisation", "s@example.com")
    donor = make_user(new_client, "donor", "d@example.com")
    need(school, "Chairs for classrooms")
    lid = listing(donor, "Plastic chairs")
    assert [m["listing"]["id"] for m in school.get("/api/me/suggestions").json()["for_my_needs"]] == [lid]
    assert len(donor.get("/api/me/suggestions").json()["for_my_items"]) == 1


# ---------------- delivery flow ----------------
def test_request_with_delivery_through_to_volunteer_dropoff(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    school = make_user(new_client, "organisation", "s@example.com")
    ravi = make_user(new_client, "volunteer", "v@example.com")
    other_vol = make_user(new_client, "volunteer", "v2@example.com")

    lid = listing(donor, "Chairs", qty=10)
    donor_listing = donor.get(f"/api/listings/{lid}").json()
    nid = need(school, "Chairs for classrooms", **WHITEFIELD)

    # a need from another category can't be attached
    wrong = need(school, "Blankets", category="clothing")
    assert school.post(f"/api/listings/{lid}/claims", json={"need_id": wrong}).status_code == 422

    cid = school.post(f"/api/listings/{lid}/claims", json={"need_id": nid, "wants_delivery": True}).json()["id"]
    accepted = donor.post(f"/api/claims/{cid}/accept").json()
    assert accepted["delivery_status"] == "open" and accepted["need_id"] == nid

    # volunteers only: donors can't use the delivery board
    assert donor.get("/api/deliveries").status_code == 403

    open_tasks = ravi.get("/api/deliveries?near_lat=12.935&near_lng=77.625").json()
    assert len(open_tasks) == 1
    task = open_tasks[0]
    assert task["pickup"]["lat"] == round(donor_listing["lat"], 3)  # rounded until assigned

    route = ravi.post("/api/deliveries/plan", json={"start_lat": 12.93, "start_lng": 77.62}).json()
    assert [s["kind"] for s in route["stops"]] == ["pickup", "dropoff"]
    assert route["total_km"] > 0 and route["minutes"] > 0

    assert ravi.post("/api/deliveries/assign", json={"task_ids": [task["id"]]}).status_code == 200
    assert other_vol.post("/api/deliveries/assign", json={"task_ids": [task["id"]]}).status_code == 409
    mine = ravi.get("/api/deliveries?scope=mine").json()[0]
    assert mine["pickup"]["lat"] == donor_listing["lat"]  # exact once assigned

    assert ravi.post(f"/api/deliveries/{task['id']}/deliver").status_code == 409  # pickup first
    assert ravi.post(f"/api/deliveries/{task['id']}/pickup").json()["status"] == "picked_up"
    # with the item on board, the next plan only has the drop-off left
    replanned = ravi.post("/api/deliveries/plan", json={"start_lat": 12.93, "start_lng": 77.62}).json()
    assert [s["kind"] for s in replanned["stops"]] == ["dropoff"]
    assert ravi.post(f"/api/deliveries/{task['id']}/deliver").json()["status"] == "delivered"

    assert donor.get(f"/api/listings/{lid}").json()["status"] == "completed"
    assert school.get("/api/me/claims").json()[0]["status"] == "completed"


def test_cancelling_a_request_cancels_its_delivery(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    school = make_user(new_client, "organisation", "s@example.com")
    ravi = make_user(new_client, "volunteer", "v@example.com")
    lid = listing(donor, "Chairs")
    cid = school.post(f"/api/listings/{lid}/claims", json={"wants_delivery": True}).json()["id"]
    donor.post(f"/api/claims/{cid}/accept")
    assert len(ravi.get("/api/deliveries").json()) == 1
    school.post(f"/api/claims/{cid}/cancel")
    assert ravi.get("/api/deliveries").json() == []
