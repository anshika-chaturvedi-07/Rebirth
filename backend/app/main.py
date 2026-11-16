from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.data.categories import CATEGORIES, CATEGORY_BY_SLUG, Category

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="REBIRTH — a world where everything gets a second chance.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "environment": settings.environment}


@app.get("/api/region", tags=["system"])
def region() -> dict:
    """Region settings the frontend uses for currency, language and the map."""
    return {
        "region": settings.region_code,
        "currency": settings.currency,
        "default_locale": settings.default_locale,
        "locales": settings.supported_locales,
        "map_center": {"lat": settings.map_center_lat, "lng": settings.map_center_lng},
    }


@app.get("/api/categories", response_model=list[Category], tags=["catalog"])
def list_categories() -> list[Category]:
    return CATEGORIES


@app.get("/api/categories/{slug}", response_model=Category, tags=["catalog"])
def get_category(slug: str) -> Category:
    category = CATEGORY_BY_SLUG.get(slug)
    if category is None:
        raise HTTPException(status_code=404, detail=f"No category called '{slug}'.")
    return category
