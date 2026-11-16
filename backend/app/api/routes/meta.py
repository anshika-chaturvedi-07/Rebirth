from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.data import places
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


@router.get("/places", response_model=list[places.Place], tags=["geo"])
def search_places(q: Annotated[str, Query(min_length=1, max_length=60)], city: str | None = None) -> list[places.Place]:
    """Locality / city autocomplete from the built-in gazetteer (no third-party geocoding)."""
    return places.search(q, city)


@router.get("/places/resolve", response_model=places.Place | None, tags=["geo"])
def resolve_place(city: Annotated[str, Query(min_length=2)], area: str = "") -> places.Place | None:
    coords = places.resolve(area, city)
    if coords is None:
        return None
    c = places.canonical_city(city) or city
    return places.Place(name=area or c, city=c, lat=coords[0], lng=coords[1], kind="locality" if area else "city")


@router.get("/categories", response_model=list[Category], tags=["catalog"])
def list_categories() -> list[Category]:
    return CATEGORIES


@router.get("/categories/{slug}", response_model=Category, tags=["catalog"])
def get_category(slug: str) -> Category:
    category = CATEGORY_BY_SLUG.get(slug)
    if category is None:
        raise HTTPException(status_code=404, detail=f"No category called '{slug}'.")
    return category
