"""REBIRTH resource taxonomy.

Each category carries the rules that drive the hybrid lifecycle:
  free priority window -> low-price marketplace -> repair / recycle.
Impact factors are indicative averages and must be replaced with sourced LCA data
before any public claims are made.
"""

from pydantic import BaseModel


class Category(BaseModel):
    slug: str
    name: str
    name_hi: str
    icon: str
    color: str
    unit: str  # "kg" or "items"
    kg_per_unit: float
    priority_window_hours: int  # how long the item is free-only for NGOs / people in need
    perishable: bool
    co2e_per_kg: float  # kg CO2e avoided per kg reused (indicative)
    subcategories: list[str]


CATEGORIES: list[Category] = [
    Category(slug="food", name="Food & groceries", name_hi="भोजन", icon="🍲", color="#FF8C73", unit="kg",
             kg_per_unit=1, priority_window_hours=2, perishable=True, co2e_per_kg=2.5,
             subcategories=["Cooked meals", "Fresh produce", "Bakery", "Packaged food", "Dry rations"]),
    Category(slug="electronics", name="Electronics", name_hi="इलेक्ट्रॉनिक्स", icon="💻", color="#74CCEC", unit="items",
             kg_per_unit=3, priority_window_hours=168, perishable=False, co2e_per_kg=40,
             subcategories=["Laptops", "Phones", "Monitors", "Appliances", "Accessories", "E-waste"]),
    Category(slug="furniture", name="Furniture", name_hi="फर्नीचर", icon="🪑", color="#9FE3C9", unit="items",
             kg_per_unit=12, priority_window_hours=120, perishable=False, co2e_per_kg=3.5,
             subcategories=["Chairs", "Tables & desks", "Beds", "Storage", "Sofas"]),
    Category(slug="clothing", name="Clothing & textiles", name_hi="कपड़े", icon="👕", color="#FFB8CB", unit="kg",
             kg_per_unit=1, priority_window_hours=120, perishable=False, co2e_per_kg=15,
             subcategories=["Clothes", "Shoes", "Blankets & bedding", "Uniforms", "Fabric"]),
    Category(slug="construction", name="Construction materials", name_hi="निर्माण सामग्री", icon="🧱", color="#FFD66B", unit="kg",
             kg_per_unit=1, priority_window_hours=168, perishable=False, co2e_per_kg=0.8,
             subcategories=["Bricks", "Timber", "Tiles", "Steel", "Paint", "Fixtures"]),
    Category(slug="books", name="Books & stationery", name_hi="किताबें", icon="📚", color="#B39DF5", unit="kg",
             kg_per_unit=1, priority_window_hours=120, perishable=False, co2e_per_kg=2.2,
             subcategories=["Textbooks", "Storybooks", "Notebooks", "Art supplies"]),
    Category(slug="home-kitchen", name="Home & kitchen", name_hi="घर और रसोई", icon="🍳", color="#C2EF6B", unit="items",
             kg_per_unit=2, priority_window_hours=120, perishable=False, co2e_per_kg=3,
             subcategories=["Utensils", "Cookware", "Appliances", "Decor", "Lighting"]),
    Category(slug="toys-baby", name="Toys & baby items", name_hi="खिलौने", icon="🧸", color="#FFB8CB", unit="items",
             kg_per_unit=1.5, priority_window_hours=120, perishable=False, co2e_per_kg=4,
             subcategories=["Toys", "Prams", "Cribs", "Baby clothes"]),
    Category(slug="sports", name="Sports & fitness", name_hi="खेल", icon="⚽", color="#74CCEC", unit="items",
             kg_per_unit=4, priority_window_hours=120, perishable=False, co2e_per_kg=4,
             subcategories=["Bicycles", "Equipment", "Gym gear"]),
    Category(slug="medical", name="Medical & mobility aids", name_hi="चिकित्सा सहायता", icon="🩺", color="#9FE3C9", unit="items",
             kg_per_unit=8, priority_window_hours=168, perishable=False, co2e_per_kg=5,
             subcategories=["Wheelchairs", "Crutches & walkers", "Sealed supplies"]),
    Category(slug="tools", name="Tools & hardware", name_hi="औज़ार", icon="🔧", color="#FFD66B", unit="items",
             kg_per_unit=3, priority_window_hours=120, perishable=False, co2e_per_kg=6,
             subcategories=["Power tools", "Hand tools", "Garden tools"]),
    Category(slug="office", name="Industrial & office surplus", name_hi="कार्यालय सामग्री", icon="🏭", color="#B39DF5", unit="kg",
             kg_per_unit=1, priority_window_hours=120, perishable=False, co2e_per_kg=2,
             subcategories=["Office supplies", "Packaging", "Machinery"]),
    Category(slug="scrap", name="Scrap & recyclables", name_hi="कबाड़", icon="♻️", color="#C2EF6B", unit="kg",
             kg_per_unit=1, priority_window_hours=24, perishable=False, co2e_per_kg=1.5,
             subcategories=["Metal", "Plastic", "Paper & cardboard", "Glass"]),
    Category(slug="other", name="Anything else", name_hi="अन्य", icon="📦", color="#FF8C73", unit="items",
             kg_per_unit=2, priority_window_hours=120, perishable=False, co2e_per_kg=2,
             subcategories=[]),
]

CATEGORY_BY_SLUG = {c.slug: c for c in CATEGORIES}
