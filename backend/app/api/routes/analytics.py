from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.db.session import utcnow
from app.services import forecasting, impact

router = APIRouter(prefix="/api", tags=["impact & insights"])

FORECAST_CATEGORIES = ["food", "clothing", "books", "furniture", "electronics", "construction"]


def _city(city: str | None) -> str:
    return city or get_settings().default_city


@router.get("/impact")
def city_impact(db: DB, city: str | None = None) -> dict:
    """Public city-wide impact: totals, categories, months, stages, rehome rate and neighbourhood circularity."""
    c = _city(city)
    return {"city": c, **impact.city_impact(db, c, utcnow())}


@router.get("/impact/me")
def my_impact(db: DB, user: CurrentUser) -> dict:
    return impact.user_impact(db, user.id, utcnow())


@router.get("/insights/forecast")
def forecast(db: DB, city: str | None = None, horizon: Annotated[int, Query(ge=2, le=12)] = 8) -> dict:
    """Supply vs demand forecasts per category with backtests and shortage/surplus alerts."""
    return forecasting.city_forecast(db, _city(city), utcnow(), FORECAST_CATEGORIES, horizon)


@router.get("/insights/hotspots")
def hotspots(db: DB, kind: Literal["supply", "demand"] = "supply", city: str | None = None,
             days: Annotated[int, Query(ge=7, le=730)] = 180) -> dict:
    """~1 km grid cells for a heatmap. Cells with fewer than 3 records are hidden for privacy."""
    c = _city(city)
    return {"city": c, "kind": kind, "days": days, "cells": impact.hotspots(db, c, kind, utcnow(), days)}
