"""A small built-in gazetteer of Indian cities and Bengaluru localities.

It lets people pick a locality without sending addresses to a third-party geocoding service,
and gives every listing a map position even when the browser can't share a location.
Coordinates are approximate locality centres.
"""

import unicodedata

from pydantic import BaseModel


class Place(BaseModel):
    name: str
    city: str
    lat: float
    lng: float
    kind: str  # "city" or "locality"


CITIES: dict[str, tuple[float, float]] = {
    "Bengaluru": (12.9716, 77.5946), "Mumbai": (19.0760, 72.8777), "Delhi": (28.6139, 77.2090),
    "Hyderabad": (17.3850, 78.4867), "Chennai": (13.0827, 80.2707), "Kolkata": (22.5726, 88.3639),
    "Pune": (18.5204, 73.8567), "Ahmedabad": (23.0225, 72.5714), "Jaipur": (26.9124, 75.7873),
    "Lucknow": (26.8467, 80.9462), "Kochi": (9.9312, 76.2673), "Chandigarh": (30.7333, 76.7794),
    "Indore": (22.7196, 75.8577), "Bhopal": (23.2599, 77.4126), "Noida": (28.5355, 77.3910),
    "Gurugram": (28.4595, 77.0266), "Mysuru": (12.2958, 76.6394), "Coimbatore": (11.0168, 76.9558),
    "Visakhapatnam": (17.6868, 83.2185), "Nagpur": (21.1458, 79.0882), "Patna": (25.5941, 85.1376),
    "Bhubaneswar": (20.2961, 85.8245), "Guwahati": (26.1445, 91.7362), "Thiruvananthapuram": (8.5241, 76.9366),
}

CITY_ALIASES = {
    "bangalore": "Bengaluru", "bombay": "Mumbai", "new delhi": "Delhi", "calcutta": "Kolkata",
    "madras": "Chennai", "gurgaon": "Gurugram", "mysore": "Mysuru", "trivandrum": "Thiruvananthapuram",
    "vizag": "Visakhapatnam", "cochin": "Kochi",
}

LOCALITIES: dict[str, dict[str, tuple[float, float]]] = {
    "Bengaluru": {
        "Koramangala": (12.9352, 77.6245), "Indiranagar": (12.9719, 77.6412), "Jayanagar": (12.9250, 77.5938),
        "HSR Layout": (12.9116, 77.6474), "Whitefield": (12.9698, 77.7500), "Malleshwaram": (13.0031, 77.5643),
        "BTM Layout": (12.9166, 77.6101), "Electronic City": (12.8452, 77.6602), "Yelahanka": (13.1007, 77.5963),
        "Marathahalli": (12.9591, 77.6974), "JP Nagar": (12.9063, 77.5857), "Basavanagudi": (12.9406, 77.5738),
        "Rajajinagar": (12.9910, 77.5525), "Hebbal": (13.0358, 77.5970), "Banashankari": (12.9255, 77.5468),
        "Bellandur": (12.9304, 77.6784), "Sarjapur Road": (12.9010, 77.6860), "MG Road": (12.9756, 77.6050),
        "Frazer Town": (12.9970, 77.6140), "Yeshwanthpur": (13.0280, 77.5400), "Kengeri": (12.9081, 77.4823),
        "Bannerghatta Road": (12.8880, 77.5970), "Ulsoor": (12.9817, 77.6286), "RT Nagar": (13.0213, 77.5946),
    },
}


def _norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s).casefold().strip()


def canonical_city(city: str) -> str | None:
    key = _norm(city)
    if key in CITY_ALIASES:
        return CITY_ALIASES[key]
    return next((c for c in CITIES if _norm(c) == key), None)


def resolve(area: str, city: str) -> tuple[float, float] | None:
    """Best-effort coordinates for an area + city, falling back to the city centre."""
    c = canonical_city(city)
    if c is None:
        return None
    if area:
        a = _norm(area)
        for name, coords in LOCALITIES.get(c, {}).items():
            if _norm(name) == a:
                return coords
    return CITIES[c]


def search(q: str, city: str | None = None, limit: int = 8) -> list[Place]:
    needle = _norm(q)
    if not needle:
        return []
    results: list[Place] = []
    city_filter = canonical_city(city) if city else None
    for c, locs in LOCALITIES.items():
        if city_filter and c != city_filter:
            continue
        for name, (lat, lng) in locs.items():
            if needle in _norm(name):
                results.append(Place(name=name, city=c, lat=lat, lng=lng, kind="locality"))
    for c, (lat, lng) in CITIES.items():
        aliases = [a for a, target in CITY_ALIASES.items() if target == c]
        if needle in _norm(c) or any(needle in a for a in aliases):
            results.append(Place(name=c, city=c, lat=lat, lng=lng, kind="city"))
    # prefix matches first
    results.sort(key=lambda p: (not _norm(p.name).startswith(needle), p.kind != "locality", p.name))
    return results[:limit]
