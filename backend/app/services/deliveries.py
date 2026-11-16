from sqlalchemy.orm import Session

from app.data import places
from app.models import Claim, DeliveryStatus, DeliveryTask

ACTIVE = (DeliveryStatus.open, DeliveryStatus.assigned, DeliveryStatus.picked_up)


def _resolve(area: str, city: str) -> tuple[float, float]:
    return places.resolve(area, city) or places.CITIES["Bengaluru"]


def create_for_claim(db: Session, claim: Claim) -> DeliveryTask:
    """Pickup at the donor's exact listing location; drop-off at the need's location (or the requester's city)."""
    listing = claim.listing
    p_lat, p_lng = (listing.lat, listing.lng) if listing.lat is not None else _resolve(listing.area, listing.city)
    need = claim.need
    if need is not None and need.lat is not None:
        d_lat, d_lng, d_area = need.lat, need.lng, need.area or need.city
    else:
        d_lat, d_lng = _resolve("", claim.claimant.city)
        d_area = claim.claimant.city
    task = DeliveryTask(
        claim_id=claim.id,
        pickup_lat=p_lat, pickup_lng=p_lng,
        pickup_label=f"{listing.donor.name} · {listing.area or listing.city}",
        dropoff_lat=d_lat, dropoff_lng=d_lng,
        dropoff_label=f"{claim.claimant.name} · {d_area}",
    )
    db.add(task)
    return task


def cancel_for_claim(claim: Claim) -> None:
    if claim.delivery is not None and claim.delivery.status in ACTIVE:
        claim.delivery.status = DeliveryStatus.cancelled
