import pytest

from app.core import config
from app.core.config import Settings
from app.services import photos


@pytest.fixture()
def fresh_settings(monkeypatch):
    """Rebuild settings from the environment for one test, then restore the cached ones."""
    config.get_settings.cache_clear()
    yield monkeypatch
    config.get_settings.cache_clear()


@pytest.mark.parametrize("url", [
    "postgres://u:p@host.neon.tech/db?sslmode=require",
    "postgresql://u:p@host.neon.tech/db?sslmode=require",
])
def test_hosted_postgres_urls_get_the_psycopg_driver(url):
    assert Settings(database_url=url).database_url == "postgresql+psycopg://u:p@host.neon.tech/db?sslmode=require"


def test_sqlite_url_is_left_alone():
    assert Settings(database_url="sqlite:///./x.db").database_url == "sqlite:///./x.db"


def test_production_refuses_the_dev_secret(fresh_settings):
    fresh_settings.setenv("ENVIRONMENT", "production")
    fresh_settings.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        config.get_settings()


def test_production_requires_secure_cookies(fresh_settings):
    fresh_settings.setenv("ENVIRONMENT", "production")
    fresh_settings.setenv("JWT_SECRET", "x" * 48)
    fresh_settings.setenv("COOKIE_SECURE", "false")
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        config.get_settings()
    fresh_settings.setenv("COOKIE_SECURE", "true")
    config.get_settings.cache_clear()
    assert config.get_settings().is_production


def test_cloudinary_signature_matches_their_documented_example():
    # https://cloudinary.com/documentation/authentication_signatures (worked example)
    params = {"eager": "w_400,h_300,c_pad|w_260,h_200,c_crop", "public_id": "sample_image", "timestamp": "1315060510"}
    assert photos._signature(params, "abcd") == "bfd09f95f331f558cbd1320e67aa8d488770583e"


def test_cloudinary_url_parsing(fresh_settings):
    fresh_settings.setenv("CLOUDINARY_URL", "cloudinary://123:secret@demo-cloud")
    assert photos._cloudinary() == ("demo-cloud", "123", "secret")
    fresh_settings.setenv("CLOUDINARY_URL", "https://wrong")
    config.get_settings.cache_clear()
    with pytest.raises(photos.PhotoError):
        photos._cloudinary()
