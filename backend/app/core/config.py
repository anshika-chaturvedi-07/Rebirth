from functools import lru_cache

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

    cors_origins: list[str] = ["http://localhost:3000"]

    # SQLite needs no setup for local development; point this at Postgres in docker/production.
    database_url: str = "sqlite:///./rebirth.db"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"
    session_days: int = 7
    session_cookie: str = "rebirth_session"
    cookie_secure: bool = False  # True behind HTTPS

    # Lifecycle rules
    marketplace_days: int = 14  # how long non-perishables stay in the marketplace before the recycle stage
    max_active_free_claims_individual: int = 3  # fair-use limit for individuals

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and s.jwt_secret.startswith("dev-only"):
        raise RuntimeError("Set JWT_SECRET before running in production.")
    return s
