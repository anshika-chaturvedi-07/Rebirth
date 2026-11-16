"""Fill the database with demo accounts, listings and needs (Bengaluru).

Run after migrations:  python -m app.seed   (add --reset to wipe existing rows first)

Every demo account uses the password  rebirth-demo  — these are local test accounts only.
"""

import sys
from datetime import timedelta

from sqlalchemy import delete, select

from app.core.security import hash_password
from app.data import places
from app.data.categories import CATEGORY_BY_SLUG
from app.db.session import SessionLocal, utcnow
from app.models import Claim, Listing, Need, User
from app.services.lifecycle import lifecycle_windows, suggest_price

DEMO_PASSWORD = "rebirth-demo"

USERS = [
    # key, role, name, email, verified
    ("meera", "donor", "Meera · Spice Route Kitchen", "meera@rebirth.test", False),
    ("dadi", "donor", "Kamala Dadi", "dadi@rebirth.test", False),
    ("brightlabs", "business", "Brightlabs Software", "csr@brightlabs.rebirth.test", False),
    ("fatima", "organisation", "Sunrise Public School", "fatima@rebirth.test", True),
    ("hope", "organisation", "Hope Night Shelter", "hope@rebirth.test", True),
    ("aarav", "individual", "Aarav Kumar", "aarav@rebirth.test", False),
    ("ravi", "volunteer", "Ravi Shetty", "ravi@rebirth.test", False),
    ("kabir", "recycler", "Kabir's Repair Studio", "kabir@rebirth.test", False),
]

AREAS = places.LOCALITIES["Bengaluru"]

# donor, title, category, subcategory, qty, condition, area, original price, hours ago, best-before hours from now, description
LISTINGS = [
    ("meera", "Surplus veg biryani trays", "food", "Cooked meals", 25, "good", "Koramangala", None, 0.5, 4,
     "Freshly cooked tonight, packed in sealed trays. Enough for about 60 people."),
    ("meera", "Day-old bread and buns", "food", "Bakery", 8, "good", "Koramangala", None, 3, 20,
     "From this morning's batch. Still soft, best toasted."),
    ("brightlabs", "Dell Inspiron laptops (2019), working", "electronics", "Laptops", 6, "good", "Whitefield", 45000, 20, None,
     "i5, 8 GB RAM, fresh Windows install. Chargers included."),
    ("brightlabs", '24" office monitors', "electronics", "Monitors", 12, "good", "Whitefield", 9000, 200, None,
     "HDMI and VGA. A few have small scratches on the stand."),
    ("brightlabs", "Ergonomic office chairs", "furniture", "Chairs", 20, "fair", "Whitefield", 6000, 30, None,
     "Office refurbishment leftovers. Height adjustable."),
    ("dadi", "Usha sewing machine", "home-kitchen", "Appliances", 1, "good", "Jayanagar", 8000, 10, None,
     "Treadle machine, works well. Looking for someone who will use it to earn."),
    ("dadi", "Steel bookshelf", "furniture", "Storage", 1, "fair", "Jayanagar", 3500, 150, None,
     "5 shelves, a little rust at the base."),
    ("dadi", "Woollen blankets", "clothing", "Blankets & bedding", 6, "good", "Jayanagar", None, 4, None,
     "Washed and folded. Perfect for winter."),
    ("aarav", "Class 10 CBSE textbooks", "books", "Textbooks", 4, "good", "BTM Layout", 1600, 50, None,
     "Full set, light pencil marks."),
    ("kabir", "Leftover acrylic paint tins", "construction", "Paint", 12, "fair", "HSR Layout", 2400, 260, None,
     "Mixed colours, half full. Good for murals."),
    ("brightlabs", "Broken keyboards and mice", "electronics", "E-waste", 15, "needs_repair", "Whitefield", 300, 600, None,
     "Some keys missing. For repair or certified e-waste recycling."),
    ("meera", "Red bricks from renovation", "construction", "Bricks", 400, "good", "Indiranagar", None, 12, None,
     "Clean, stacked, roughly 150 bricks."),
]

NEEDS = [
    ("fatima", "Chairs for two new classrooms", "furniture", 30, 3, "Malleshwaram", "Starting the new term with 60 more students."),
    ("fatima", "Projector for the science lab", "electronics", 1, 2, "Malleshwaram", "Any working projector with HDMI."),
    ("hope", "Dinner for 120 residents", "food", 50, 3, "BTM Layout", "Cooked food or ingredients, every evening."),
    ("hope", "Blankets before winter", "clothing", 40, 2, "BTM Layout", "Clean blankets and warm clothes."),
    ("aarav", "Laptop for coding classes", "electronics", 1, 2, "BTM Layout", "First-year engineering student, need it for labs."),
]


def run(reset: bool = False) -> None:
    db = SessionLocal()
    try:
        if reset:
            for model in (Claim, Need, Listing, User):
                db.execute(delete(model))
            db.commit()
        if db.scalar(select(User.id).limit(1)):
            print("Database already has data. Use --reset to start fresh.")
            return

        pw = hash_password(DEMO_PASSWORD)
        users: dict[str, User] = {}
        for key, role, name, email, verified in USERS:
            users[key] = User(role=role, name=name, email=email, city="Bengaluru", password_hash=pw, verified=verified)
            db.add(users[key])
        db.flush()

        now = utcnow()
        for donor, title, cat, sub, qty, cond, area, price, hours_ago, bb_hours, desc in LISTINGS:
            created = now - timedelta(hours=hours_ago)
            best_before = now + timedelta(hours=bb_hours) if bb_hours is not None else None
            priority_until, marketplace_until = lifecycle_windows(cat, created, best_before)
            lat, lng = AREAS[area]
            db.add(Listing(
                donor_id=users[donor].id, title=title, description=desc, category=cat, subcategory=sub, quantity=qty,
                unit=CATEGORY_BY_SLUG[cat].unit, condition=cond, city="Bengaluru", area=area, lat=lat, lng=lng,
                original_price_inr=price, price_inr=suggest_price(price, cond),
                priority_until=priority_until, marketplace_until=marketplace_until, created_at=created,
            ))

        for who, title, cat, qty, urgency, area, desc in NEEDS:
            lat, lng = AREAS[area]
            db.add(Need(
                requester_id=users[who].id, title=title, description=desc, category=cat, quantity=qty,
                unit=CATEGORY_BY_SLUG[cat].unit, urgency=urgency, city="Bengaluru", area=area, lat=lat, lng=lng,
            ))
        db.commit()
        print(f"Seeded {len(USERS)} accounts, {len(LISTINGS)} listings, {len(NEEDS)} needs. Password for all: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    run(reset="--reset" in sys.argv)
