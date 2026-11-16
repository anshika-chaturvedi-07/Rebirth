from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.data.categories import CATEGORIES, CATEGORY_BY_SLUG, Category

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health() -> dict:
    s = get_settings()
    return {"status": "ok", "service": s.app_name, "environment": s.environment}


@router.get("/region")
def region() -> dict:
    """Region settings the frontend uses for currency, language and the map."""
    s = get_settings()
    return {
        "region": s.region_code,
        "currency": s.currency,
        "default_locale": s.default_locale,
        "locales": s.supported_locales,
        "default_city": s.default_city,
        "map_center": {"lat": s.map_center_lat, "lng": s.map_center_lng},
    }


@router.get("/categories", response_model=list[Category], tags=["catalog"])
def list_categories() -> list[Category]:
    return CATEGORIES


@router.get("/categories/{slug}", response_model=Category, tags=["catalog"])
def get_category(slug: str) -> Category:
    category = CATEGORY_BY_SLUG.get(slug)
    if category is None:
        raise HTTPException(status_code=404, detail=f"No category called '{slug}'.")
    return category
