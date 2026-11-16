import io
import math

import pytest
from PIL import Image

from app.api.routes import photos as photos_route
from app.core.config import get_settings
from app.vision.analyzer import analyze
from app.vision.engine import ml_installed
from tests.conftest import make_user


@pytest.fixture(autouse=True)
def tmp_media(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "media_dir", str(tmp_path))
    return tmp_path


def png_bytes(size=(64, 32), color=(200, 120, 90)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def jpeg_with_gps_and_rotation() -> bytes:
    img = Image.new("RGB", (60, 20), (10, 200, 10))
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotate 90° when displayed
    exif[0x8825] = {1: "N", 2: (12.0, 56.0, 7.0), 3: "E", 4: (77.0, 37.0, 28.0)}  # GPS IFD
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def upload(client, data: bytes, name="photo.png", ctype="image/png"):
    return client.post("/api/photos", files={"file": (name, data, ctype)})


# ---------------- uploads ----------------
def test_upload_strips_gps_and_applies_rotation(new_client, tmp_media):
    donor = make_user(new_client, "donor", "d@example.com")
    res = upload(donor, jpeg_with_gps_and_rotation(), "phone.jpg", "image/jpeg")
    assert res.status_code == 201, res.text
    body = res.json()
    assert (body["width"], body["height"]) == (20, 60)  # rotated upright
    stored = Image.open(tmp_media / body["url"].rsplit("/", 1)[1])
    assert stored.format == "JPEG"
    assert len(stored.getexif()) == 0  # no GPS, no metadata at all
    assert body["url"].startswith("/media/") and body["url"].endswith(".jpg")


def test_upload_rejects_non_images_and_requires_sign_in(new_client, client):
    assert upload(client, png_bytes()).status_code == 401
    donor = make_user(new_client, "donor", "d@example.com")
    res = upload(donor, b"<?php echo 'hi'; ?>", "evil.png", "image/png")
    assert res.status_code == 422 and "isn't a photo" in res.json()["detail"]


def test_large_images_are_downscaled(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    body = upload(donor, png_bytes((3000, 1500))).json()
    assert max(body["width"], body["height"]) == get_settings().photo_max_px


def test_photos_attach_to_listing_in_order_and_only_once(new_client):
    donor = make_user(new_client, "donor", "d@example.com")
    other = make_user(new_client, "donor", "o@example.com")
    a = upload(donor, png_bytes()).json()
    b = upload(donor, png_bytes(color=(1, 2, 3))).json()
    theirs = upload(other, png_bytes()).json()
    base = {"title": "Chair", "category": "furniture", "quantity": 1, "city": "Bengaluru"}

    listing = donor.post("/api/listings", json={**base, "photo_ids": [b["id"], a["id"]]}).json()
    assert listing["photos"] == [b["url"], a["url"]]
    assert donor.post("/api/listings", json={**base, "photo_ids": [a["id"]]}).status_code == 422  # already used
    assert donor.post("/api/listings", json={**base, "photo_ids": [theirs["id"]]}).status_code == 422  # not yours


# ---------------- vision ----------------
class FakeEngine:
    """Scores prompts by keyword so tests are fast and deterministic."""

    name = "fake"

    def __init__(self, *keywords: str):
        self.keywords = keywords

    def zero_shot(self, image, prompts):
        scores = [sum(8.0 for k in self.keywords if k in p) for p in prompts]
        exps = [math.exp(s) for s in scores]
        total = sum(exps)
        return [e / total for e in exps]


def run(*keywords):
    return analyze(Image.new("RGB", (32, 32)), FakeEngine(*keywords))


def test_recognises_category_subcategory_title_and_condition():
    r = run("laptop", "broken")
    assert (r.category, r.subcategory, r.title) == ("electronics", "Laptops", "Laptop")
    assert r.confident and r.is_item and not r.blocked
    assert r.condition == "needs_repair"
    assert r.alternatives[0].category == "electronics"


def test_not_an_item_and_restricted_items():
    assert run("selfie").is_item is False
    blocked = run("medicine")
    assert blocked.blocked and "Medicines" in blocked.warnings[0]


def test_spoiled_food_warning():
    r = run("biryani", "spoiled")
    assert r.category == "food" and any("may not be fresh" in w for w in r.warnings)


def test_analyze_endpoint(new_client, monkeypatch):
    donor = make_user(new_client, "donor", "d@example.com")
    other = make_user(new_client, "donor", "o@example.com")
    pid = upload(donor, png_bytes()).json()["id"]

    monkeypatch.setattr(photos_route, "get_engine", lambda: None)
    assert donor.post("/api/vision/analyze", json={"photo_id": pid}).status_code == 503

    monkeypatch.setattr(photos_route, "get_engine", lambda: FakeEngine("bicycle"))
    res = donor.post("/api/vision/analyze", json={"photo_id": pid}).json()
    assert (res["category"], res["title"]) == ("sports", "Bicycle")
    assert other.post("/api/vision/analyze", json={"photo_id": pid}).status_code == 404  # not their photo


@pytest.mark.skipif(not ml_installed(), reason="ML stack (requirements-ml.txt) not installed")
def test_real_clip_runs_end_to_end():
    """Smoke test with the real model: it must return a well-formed result."""
    from app.vision.engine import get_engine

    engine = get_engine()
    assert engine is not None
    r = analyze(Image.new("RGB", (224, 224), (180, 120, 60)), engine)
    assert r.model.startswith("OpenCLIP")
    assert r.blocked or not r.is_item or r.category is not None
