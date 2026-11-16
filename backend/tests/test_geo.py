import pytest

from app.data import places
from app.services.geo import bounding_box, haversine_km, public_coord
from tests.conftest import make_user

# Real locality centres in Bengaluru
KORAMANGALA = (12.9352, 77.6245)
INDIRANAGAR = (12.9719, 77.6412)
WHITEFIELD = (12.9698, 77.7500)
YELAHANKA = (13.1007, 77.5963)


def test_haversine_matches_known_distance():
    # Bengaluru centre to Mysuru centre is ~128 km as the crow flies
    assert haversine_km(12.9716, 77.5946, 12.2958, 76.6394) == pytest.approx(128, abs=3)
    assert haversine_km(*KORAMANGALA, *KORAMANGALA) == 0


def test_bounding_box_contains_circle():
    box = bounding_box(*KORAMANGALA, 5)
    for lat, lng in [(KORAMANGALA[0] + 0.044, KORAMANGALA[1]), (KORAMANGALA[0], KORAMANGALA[1] + 0.046)]:
        assert haversine_km(*KORAMANGALA, lat, lng) < 5.1
        assert box.min_lat <= lat <= box.max_lat and box.min_lng <= lng <= box.max_lng


def test_public_coords_are_rounded():
    assert public_coord(12.935212) == 12.935
    assert public_coord(None) is None


def test_gazetteer_resolves_localities_aliases_and_falls_back_to_city():
    assert places.resolve("koramangala", "Bangalore") == KORAMANGALA
    assert places.resolve("Unknown Lane", "Bengaluru") == places.CITIES["Bengaluru"]
    assert places.resolve("", "Atlantis") is None
    assert places.search("kora")[0].name == "Koramangala"
    assert places.search("bombay")[0].name == "Mumbai"


def _listing(title, area, lat=None, lng=None):
    body = {"title": title, "category": "furniture", "quantity": 1, "city": "Bengaluru", "area": area}
    if lat is not None:
        body |= {"lat": lat, "lng": lng}
    return body


def test_near_search_filters_by_radius_and_sorts_by_distance(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    donor.post("/api/listings", json=_listing("Far chair", "Yelahanka"))         # ~18 km away
    donor.post("/api/listings", json=_listing("Near chair", "Indiranagar"))      # ~4.5 km
    donor.post("/api/listings", json=_listing("Mid chair", "Whitefield"))        # ~13 km
    donor.post("/api/listings", json=_listing("Same street", "", 12.9355, 77.6248))

    lat, lng = KORAMANGALA
    page = donor.get(f"/api/listings?near_lat={lat}&near_lng={lng}&radius_km=15&sort=distance").json()
    assert [i["title"] for i in page["items"]] == ["Same street", "Near chair", "Mid chair"]
    assert page["total"] == 3
    assert page["items"][0]["distance_km"] < 0.1
    assert page["items"][1]["distance_km"] == pytest.approx(haversine_km(*KORAMANGALA, *INDIRANAGAR), abs=0.01)


def test_near_search_validation(client):
    assert client.get("/api/listings?near_lat=12.9").status_code == 422
    assert client.get("/api/listings?sort=distance").status_code == 422


def test_location_is_resolved_and_rounded_for_strangers(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    stranger = make_user(new_client, "individual", "s@example.com")
    lid = donor.post("/api/listings", json=_listing("Sofa", "", 12.935212, 77.624567)).json()["id"]

    mine = donor.get(f"/api/listings/{lid}").json()
    assert (mine["lat"], mine["lng"], mine["location_exact"]) == (12.935212, 77.624567, True)
    theirs = stranger.get(f"/api/listings/{lid}").json()
    assert (theirs["lat"], theirs["lng"], theirs["location_exact"]) == (12.935, 77.625, False)

    auto = donor.post("/api/listings", json=_listing("Desk", "Whitefield")).json()
    assert (auto["lat"], auto["lng"]) == WHITEFIELD


def test_accepted_claimant_sees_exact_location(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "n@example.com")
    lid = donor.post("/api/listings", json=_listing("Sofa", "", 12.935212, 77.624567)).json()["id"]
    cid = ngo.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    assert ngo.get(f"/api/listings/{lid}").json()["location_exact"] is False
    donor.post(f"/api/claims/{cid}/accept")
    assert ngo.get(f"/api/listings/{lid}").json()["lat"] == 12.935212


def test_needs_near_search_and_individual_privacy(new_client):
    ngo = make_user(new_client, "organisation", "n@example.com")
    person = make_user(new_client, "individual", "p@example.com")
    ngo.post("/api/needs", json={"title": "School chairs", "category": "furniture", "quantity": 10, "city": "Bengaluru", "area": "Indiranagar"})
    person.post("/api/needs", json={"title": "Laptop", "category": "electronics", "quantity": 1, "city": "Bengaluru",
                                    "lat": 12.935212, "lng": 77.624567})
    lat, lng = KORAMANGALA
    needs = ngo.get(f"/api/needs?near_lat={lat}&near_lng={lng}&radius_km=10&sort=distance").json()
    assert [n["title"] for n in needs] == ["Laptop", "School chairs"]
    assert needs[0]["lat"] == 12.935 and needs[0]["location_exact"] is False   # individual: rounded
    assert needs[1]["location_exact"] is True                                   # organisation: public place


def test_places_endpoint(client):
    res = client.get("/api/places?q=white").json()
    assert res[0]["name"] == "Whitefield" and res[0]["city"] == "Bengaluru"
    assert client.get("/api/places/resolve?city=Pune").json()["lat"] == pytest.approx(18.52, abs=0.01)
