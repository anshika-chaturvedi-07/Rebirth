from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "REBIRTH API"
    environment: str = "development"

    # Region is configuration, not code: switch currency/locale/map centre here.
    region_code: str = "IN"
    currency: str = "INR"
    default_locale: str = "en-IN"
    supported_locales: list[str] = ["en-IN", "hi-IN"]
    map_center_lat: float = 12.9716
    map_center_lng: float = 77.5946
    default_city: str = "Bengaluru"

    cors_origins: list[str] = ["http://localhost:3300"]

    # SQLite needs no setup for local development; point this at Postgres in docker/production.
    database_url: str = "sqlite:///./rebirth.db"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"
    session_days: int = 7
    session_cookie: str = "rebirth_session"
    cookie_secure: bool = False  # True behind HTTPS

    # Photos
    media_dir: str = "media"
    max_upload_mb: int = 8
    photo_max_px: int = 1600
    max_photos_per_listing: int = 4

    # AI vision (optional dependency: requirements-ml.txt)
    vision_enabled: bool = True
    vision_model: str = "ViT-B-32"
    vision_pretrained: str = "laion2b_s34b_b79k"
    vision_preload: bool = True  # warm the model up in a background thread at startup (~600 MB RAM)

    # Demo accounts: everyone uses the public demo password, except the admin, whose password must come from the
    # environment in production (no public admin account on a live site).
    admin_password: str = ""

    # Photo storage: empty = local disk (fine for development). Set CLOUDINARY_URL=cloudinary://key:secret@cloud
    # in production, where free hosts wipe the disk on every restart.
    cloudinary_url: str = ""

    # Payments: leave empty for the built-in simulated checkout; set Razorpay *test* keys to use Razorpay test mode
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Lifecycle rules
    marketplace_days: int = 14  # how long non-perishables stay in the marketplace before the recycle stage
    max_active_free_claims_individual: int = 3  # fair-use limit for individuals

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, v: str) -> str:
        # Hosted Postgres (Neon, Render, Supabase) hands out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and s.jwt_secret.startswith("dev-only"):
        raise RuntimeError("Set JWT_SECRET before running in production.")
    if s.is_production and not s.cookie_secure:
        raise RuntimeError("Set COOKIE_SECURE=true in production (the site is served over HTTPS).")
    return s
