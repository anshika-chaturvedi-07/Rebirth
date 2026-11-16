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
    cors_origins: list[str] = ["http://localhost:3000"]
    database_url: str = "postgresql+psycopg://rebirth:rebirth@localhost:5432/rebirth"
    redis_url: str = "redis://localhost:6379/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
