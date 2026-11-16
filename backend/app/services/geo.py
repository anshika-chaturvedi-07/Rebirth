"""Geospatial helpers that work on any database.

Search strategy: a cheap bounding-box filter runs in SQL (indexed lat/lng columns), then the exact
great-circle distance is computed in Python for the few remaining rows. On Postgres this can later be
swapped for PostGIS (ST_DWithin) without changing the API.
"""

import math
from dataclasses import dataclass

EARTH_RADIUS_KM = 6371.0088

# Public coordinates are rounded so a donor's exact address is never exposed on the map.
# 3 decimal places ≈ 110 m north–south.
PUBLIC_COORD_DECIMALS = 3


@dataclass(frozen=True)
class BBox:
    min_lat: float
    max_lat: float
    min_lng: float
    max_lng: float


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def bounding_box(lat: float, lng: float, radius_km: float) -> BBox:
    """Smallest lat/lng box containing the circle (safe over-approximation)."""
    dlat = math.degrees(radius_km / EARTH_RADIUS_KM)
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    dlng = math.degrees(radius_km / (EARTH_RADIUS_KM * cos_lat))
    return BBox(lat - dlat, lat + dlat, lng - dlng, lng + dlng)


def public_coord(value: float | None) -> float | None:
    return None if value is None else round(value, PUBLIC_COORD_DECIMALS)
