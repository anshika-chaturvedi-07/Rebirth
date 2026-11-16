"""Text prompts for zero-shot recognition with CLIP.

Each item label maps a short description to a REBIRTH (category, subcategory) and the noun we use to
suggest a title. Extra prompt groups catch photos that aren't donatable items (selfies, screenshots)
and items that can't be listed (medicines, alcohol, weapons).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ItemLabel:
    prompt: str  # what CLIP compares the photo with
    category: str
    subcategory: str | None
    noun: str  # used for the suggested title, e.g. "Office chair"


def L(prompt: str, category: str, subcategory: str | None, noun: str | None = None) -> ItemLabel:
    return ItemLabel(prompt, category, subcategory, noun or prompt)


ITEM_LABELS: list[ItemLabel] = [
    # food
    L("cooked rice or biryani in trays", "food", "Cooked meals", "Cooked meals"),
    L("a home-cooked Indian meal with curry and roti", "food", "Cooked meals", "Cooked meals"),
    L("loaves of bread and buns", "food", "Bakery", "Bread and buns"),
    L("cakes and pastries", "food", "Bakery", "Cakes and pastries"),
    L("fresh vegetables", "food", "Fresh produce", "Fresh vegetables"),
    L("fresh fruit", "food", "Fresh produce", "Fresh fruit"),
    L("packaged food and snacks", "food", "Packaged food", "Packaged food"),
    L("sacks of rice, flour and lentils", "food", "Dry rations", "Dry rations"),
    # electronics
    L("a laptop computer", "electronics", "Laptops", "Laptop"),
    L("a smartphone", "electronics", "Phones", "Smartphone"),
    L("a computer monitor", "electronics", "Monitors", "Monitor"),
    L("a television", "electronics", "Monitors", "Television"),
    L("a refrigerator", "electronics", "Appliances", "Refrigerator"),
    L("a washing machine", "electronics", "Appliances", "Washing machine"),
    L("a ceiling fan or table fan", "electronics", "Appliances", "Fan"),
    L("a computer keyboard and mouse", "electronics", "Accessories", "Keyboard and mouse"),
    L("a printer", "electronics", "Accessories", "Printer"),
    L("a tangle of old cables and broken electronics", "electronics", "E-waste", "E-waste"),
    # furniture
    L("a chair", "furniture", "Chairs", "Chair"),
    L("an office chair", "furniture", "Chairs", "Office chair"),
    L("a plastic chair", "furniture", "Chairs", "Plastic chair"),
    L("a desk or table", "furniture", "Tables & desks", "Table"),
    L("a bed or mattress", "furniture", "Beds", "Bed"),
    L("a bookshelf or cupboard", "furniture", "Storage", "Bookshelf"),
    L("a sofa", "furniture", "Sofas", "Sofa"),
    # clothing
    L("folded clothes and t-shirts", "clothing", "Clothes", "Clothes"),
    L("a jacket or sweater", "clothing", "Clothes", "Jacket"),
    L("a saree or kurta", "clothing", "Clothes", "Saree"),
    L("a pair of shoes", "clothing", "Shoes", "Shoes"),
    L("blankets and bedsheets", "clothing", "Blankets & bedding", "Blankets"),
    L("a school uniform", "clothing", "Uniforms", "School uniform"),
    # construction
    L("a stack of red bricks", "construction", "Bricks", "Bricks"),
    L("wooden planks and timber", "construction", "Timber", "Timber"),
    L("ceramic floor tiles", "construction", "Tiles", "Tiles"),
    L("steel rods and metal bars", "construction", "Steel", "Steel rods"),
    L("paint cans", "construction", "Paint", "Paint cans"),
    L("bags of cement", "construction", None, "Cement bags"),
    # books
    L("a stack of books", "books", "Textbooks", "Books"),
    L("school textbooks", "books", "Textbooks", "Textbooks"),
    L("children's picture books", "books", "Storybooks", "Storybooks"),
    L("notebooks and stationery", "books", "Notebooks", "Notebooks and stationery"),
    L("art supplies, paints and crayons", "books", "Art supplies", "Art supplies"),
    # home & kitchen
    L("kitchen utensils and steel plates", "home-kitchen", "Utensils", "Kitchen utensils"),
    L("cooking pots and pans", "home-kitchen", "Cookware", "Pots and pans"),
    L("a pressure cooker", "home-kitchen", "Cookware", "Pressure cooker"),
    L("a sewing machine", "home-kitchen", "Appliances", "Sewing machine"),
    L("a mixer grinder", "home-kitchen", "Appliances", "Mixer grinder"),
    L("a table lamp", "home-kitchen", "Lighting", "Lamp"),
    L("home decor and photo frames", "home-kitchen", "Decor", "Home decor"),
    # toys & baby
    L("children's toys", "toys-baby", "Toys", "Toys"),
    L("a teddy bear", "toys-baby", "Toys", "Teddy bear"),
    L("a baby stroller", "toys-baby", "Prams", "Baby stroller"),
    L("a baby cot or crib", "toys-baby", "Cribs", "Baby cot"),
    # sports
    L("a bicycle", "sports", "Bicycles", "Bicycle"),
    L("a cricket bat and ball", "sports", "Equipment", "Cricket kit"),
    L("a football or basketball", "sports", "Equipment", "Ball"),
    L("dumbbells and gym equipment", "sports", "Gym gear", "Gym equipment"),
    # medical & mobility
    L("a wheelchair", "medical", "Wheelchairs", "Wheelchair"),
    L("crutches or a walking frame", "medical", "Crutches & walkers", "Walking aid"),
    # tools
    L("a power drill", "tools", "Power tools", "Power drill"),
    L("hand tools like hammers and spanners", "tools", "Hand tools", "Hand tools"),
    L("garden tools and a watering can", "tools", "Garden tools", "Garden tools"),
    # office surplus
    L("office supplies and files", "office", "Office supplies", "Office supplies"),
    L("a pile of empty cardboard boxes", "office", "Packaging", "Cardboard boxes"),
    # scrap & recyclables
    L("scrap metal", "scrap", "Metal", "Scrap metal"),
    L("empty plastic bottles", "scrap", "Plastic", "Plastic bottles"),
    L("a stack of old newspapers", "scrap", "Paper & cardboard", "Old newspapers"),
    L("empty glass bottles and jars", "scrap", "Glass", "Glass bottles"),
]

# Photos that don't show a donatable item.
NOT_AN_ITEM = [
    "a selfie or portrait of a person's face",
    "a screenshot of a phone screen or app",
    "a document or page of text",
    "a landscape of nature or sky",
    "a completely dark or blurry photo",
]

# Things REBIRTH doesn't allow, with the reason shown to the user.
RESTRICTED: dict[str, str] = {
    "loose medicine tablets and pill strips": "Medicines can't be shared on REBIRTH. Please take them to a pharmacy return point.",
    "bottles of alcohol, beer or wine": "Alcohol can't be listed on REBIRTH.",
    "a knife, gun or weapon": "Weapons and sharp blades can't be listed on REBIRTH.",
    "cigarettes or tobacco": "Tobacco products can't be listed on REBIRTH.",
}

CONDITION_TEMPLATES: dict[str, str] = {
    "new": "a photo of a brand new {noun}, unused, in its original packaging",
    "good": "a photo of a clean, well-kept used {noun}",
    "fair": "a photo of a worn, scratched, old {noun}",
    "needs_repair": "a photo of a broken, damaged {noun} that needs repair",
}

FOOD_FRESHNESS = {
    "fresh": "a photo of fresh, appetising food",
    "spoiled": "a photo of spoiled, rotten or mouldy food",
}
