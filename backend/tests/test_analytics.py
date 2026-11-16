import math
import random
from datetime import timedelta

import pytest

from app.db.session import utcnow
from app.models import Claim, ClaimStatus, Listing, ListingStatus, Need, NeedStatus, User
from app.services import forecasting as fc
from app.services.forecasting import SEASON, backtest, fit, forecast, seasonal_naive, select_model, wape
from tests.conftest import make_user


# ---------------------------------------------------------------- impact
def _handover(client_donor, client_receiver, category, qty, area="Koramangala"):
    lid = client_donor.post("/api/listings", json={
        "title": "Test item", "category": category, "quantity": qty, "city": "Bengaluru", "area": area,
        **({"best_before": (utcnow() + timedelta(hours=3)).isoformat() + "Z"} if category == "food" else {}),
    }).json()["id"]
    cid = client_receiver.post(f"/api/listings/{lid}/claims", json={}).json()["id"]
    client_donor.post(f"/api/claims/{cid}/accept")
    client_donor.post(f"/api/claims/{cid}/complete")
    return lid


def test_impact_totals_follow_the_category_factors(new_client):
    fc.clear_cache()
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "n@example.com")
    _handover(donor, ngo, "food", 42)        # 42 kg food: 105 kg CO2e, 7,980 L water, 100 meals
    _handover(donor, ngo, "furniture", 2)    # 2 items x 12 kg = 24 kg: 84 kg CO2e
    donor.post("/api/listings", json={"title": "Open item", "category": "books", "quantity": 1, "city": "Bengaluru"})  # still open

    body = donor.get("/api/impact?city=Bengaluru").json()
    t = body["total"]
    assert t["handovers"] == 2
    assert t["kg"] == pytest.approx(66)
    assert t["co2e_kg"] == pytest.approx(42 * 2.5 + 24 * 3.5)
    assert t["meals"] == 100
    assert t["water_l"] == 42 * 190 + 24 * 20
    assert t["car_km_avoided"] == round(t["co2e_kg"] / 0.17)
    assert [c["category"] for c in body["by_category"]] == ["food", "furniture"]  # sorted by CO2e
    assert {s["stage"]: s["handovers"] for s in body["stages"]} == {"free": 2, "marketplace": 0, "recycle": 0}
    assert body["rehome_rate"] == 1.0  # the open listing hasn't ended its journey yet
    assert body["neighbourhoods"][0]["area"] == "Koramangala"
    assert 0 <= body["neighbourhoods"][0]["circularity"] <= 100


def test_withdrawn_listings_lower_the_rehome_rate(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "n@example.com")
    _handover(donor, ngo, "books", 5)
    gone = donor.post("/api/listings", json={"title": "Withdrawn item", "category": "books", "quantity": 1, "city": "Bengaluru"}).json()["id"]
    donor.delete(f"/api/listings/{gone}")
    assert donor.get("/api/impact?city=Bengaluru").json()["rehome_rate"] == 0.5


def test_personal_impact_given_and_received(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    ngo = make_user(new_client, "organisation", "n@example.com")
    _handover(donor, ngo, "clothing", 10)
    mine = donor.get("/api/impact/me").json()
    theirs = ngo.get("/api/impact/me").json()
    assert mine["given"]["total"]["kg"] == 10 and mine["received"]["total"]["handovers"] == 0
    assert theirs["received"]["total"]["co2e_kg"] == 150  # 10 kg x 15
    assert len(mine["given"]["by_month"]) == 12


def test_hotspots_hide_small_cells(new_client, db_session):
    donor = make_user(new_client, "donor", "d@example.com")
    for _ in range(3):
        donor.post("/api/listings", json={"title": "Book set", "category": "books", "quantity": 1, "city": "Bengaluru", "lat": 12.935, "lng": 77.6245})
    donor.post("/api/listings", json={"title": "lonely", "category": "books", "quantity": 1, "city": "Bengaluru", "lat": 13.10, "lng": 77.59})
    cells = donor.get("/api/insights/hotspots?kind=supply").json()["cells"]
    assert len(cells) == 1 and cells[0]["count"] == 3  # the single listing in Yelahanka is not exposed


# ---------------------------------------------------------------- forecasting maths
def seasonal_series(weeks=156, noise=0.0, seed=1):
    rng = random.Random(seed)
    return [max(0.0, 100 + 0.3 * t + 40 * math.sin(2 * math.pi * t / SEASON) + rng.gauss(0, noise)) for t in range(weeks)]


def test_wape():
    assert wape([10, 10], [12, 8]) == pytest.approx(0.2)
    assert wape([0, 0], [1, 1]) is None


def test_seasonal_model_tracks_a_clean_seasonal_series():
    y = seasonal_series()
    pred = [m for m, _, _ in forecast(fit(y, "Smoothed seasonal + trend"), 8)]
    truth = [100 + 0.3 * t + 40 * math.sin(2 * math.pi * t / SEASON) for t in range(156, 164)]
    assert wape(truth, pred) < 0.05


def test_backtest_beats_naive_on_trend_plus_season():
    y = seasonal_series(noise=5)
    bt = backtest(y)
    assert bt["model_wape"] < bt["naive_wape"]  # the trend makes "same week last year" too low
    assert bt["model"] in fc.CANDIDATES


def test_short_history_falls_back_to_damped_trend():
    y = [10.0 + t for t in range(30)]
    assert select_model(y) == "Damped trend"
    f = forecast(fit(y), 4)
    assert all(lo <= m <= hi for m, lo, hi in f)
    assert f[-1][2] - f[-1][1] > f[0][2] - f[0][1]  # intervals widen with the horizon


def test_forecasts_never_go_negative():
    y = [max(0.0, 5 - 0.1 * t) for t in range(156)]
    assert all(lo >= 0 and m >= 0 for m, lo, _ in forecast(fit(y), 8))


def test_seasonal_naive_repeats_last_year():
    y = list(range(SEASON * 2))
    assert seasonal_naive(y, 3) == [SEASON, SEASON + 1, SEASON + 2]


# ---------------------------------------------------------------- forecast report + alerts
def test_shortage_alert_from_database_history(db_session, client):
    fc.clear_cache()
    db = db_session()
    u = User(role="donor", name="d", email="d@x.test", city="Bengaluru", password_hash="!")
    db.add(u)
    db.flush()
    now = utcnow()
    for w in range(1, 157):
        when = now - timedelta(weeks=w)
        # clothing: 10 kg given but 30 kg requested every week -> a clear shortage
        db.add(Listing(donor_id=u.id, title="c", category="clothing", quantity=10, unit="kg", condition="good",
                       city="Bengaluru", created_at=when, priority_until=when, marketplace_until=when,
                       status=ListingStatus.completed))
        db.add(Need(requester_id=u.id, title="n", category="clothing", quantity=30, unit="kg", city="Bengaluru",
                    created_at=when, status=NeedStatus.fulfilled))
    db.commit()
    db.close()

    report = client.get("/api/insights/forecast?horizon=8").json()
    clothing = next(c for c in report["categories"] if c["category"] == "clothing")
    assert clothing["totals"]["demand"] == pytest.approx(240, rel=0.05)
    assert clothing["totals"]["supply"] == pytest.approx(80, rel=0.05)
    assert clothing["alert"]["kind"] == "shortage"
    assert any(a["category"] == "clothing" for a in report["alerts"])
    assert len(clothing["history"]) == 26 and len(clothing["forecast"]) == 8
    food = next(c for c in report["categories"] if c["category"] == "food")
    assert food["alert"] is None  # no data, no alert
