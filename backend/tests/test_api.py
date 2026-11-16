from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_region_defaults_to_india():
    body = client.get("/api/region").json()
    assert body["region"] == "IN"
    assert body["currency"] == "INR"
    assert "hi-IN" in body["locales"]


def test_categories_cover_all_domains():
    slugs = {c["slug"] for c in client.get("/api/categories").json()}
    assert {"food", "electronics", "furniture", "clothing", "construction", "books", "other"} <= slugs


def test_food_has_short_priority_window():
    food = client.get("/api/categories/food").json()
    assert food["perishable"] is True
    assert food["priority_window_hours"] <= 3


def test_unknown_category_returns_404():
    assert client.get("/api/categories/spaceships").status_code == 404
