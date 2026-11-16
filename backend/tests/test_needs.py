from tests.conftest import make_user

NEED = {"title": "Chairs for classrooms", "category": "furniture", "quantity": 30, "urgency": 3, "city": "Bengaluru"}


def test_only_organisations_and_individuals_post_needs(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "ngo@example.com")
    assert donor.post("/api/needs", json=NEED).status_code == 403
    res = ngo.post("/api/needs", json=NEED)
    assert res.status_code == 201 and res.json()["unit"] == "items"


def test_needs_sorted_by_urgency_and_closable(new_client):
    ngo = make_user(new_client, "organisation", "ngo@example.com")
    ngo.post("/api/needs", json={**NEED, "title": "Low priority", "urgency": 1})
    urgent = ngo.post("/api/needs", json=NEED).json()["id"]
    titles = [n["title"] for n in ngo.get("/api/needs").json()]
    assert titles == ["Chairs for classrooms", "Low priority"]

    assert ngo.patch(f"/api/needs/{urgent}", json={"status": "fulfilled"}).json()["status"] == "fulfilled"
    assert len(ngo.get("/api/needs").json()) == 1
    assert len(ngo.get("/api/needs?mine=true").json()) == 2
