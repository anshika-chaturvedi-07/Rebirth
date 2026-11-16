/**
 * Front-end view of the category taxonomy.
 * The source of truth is the API (backend/app/data/categories.py, GET /api/categories);
 * this copy keeps the marketing pages static and fast.
 */
export interface CategoryTile {
  slug: string;
  icon: string;
  name: string;
  hint: string;
  tint: string; // tailwind bg class
}

export const CATEGORY_TILES: CategoryTile[] = [
  { slug: "food", icon: "🍲", name: "Food", hint: "2-hour window", tint: "bg-coral-t" },
  { slug: "electronics", icon: "💻", name: "Electronics", hint: "Laptops, phones", tint: "bg-sky-t" },
  { slug: "furniture", icon: "🪑", name: "Furniture", hint: "Chairs, beds", tint: "bg-mint-t" },
  { slug: "clothing", icon: "👕", name: "Clothing", hint: "Clothes, blankets", tint: "bg-blush-t" },
  { slug: "construction", icon: "🧱", name: "Construction", hint: "Bricks, tiles", tint: "bg-butter-t" },
  { slug: "books", icon: "📚", name: "Books", hint: "Stationery too", tint: "bg-lavender-t" },
  { slug: "home-kitchen", icon: "🍳", name: "Home & kitchen", hint: "Utensils, decor", tint: "bg-lime-t" },
  { slug: "toys-baby", icon: "🧸", name: "Toys & baby", hint: "Prams, cribs", tint: "bg-blush-t" },
  { slug: "sports", icon: "⚽", name: "Sports", hint: "Bikes, gear", tint: "bg-sky-t" },
  { slug: "medical", icon: "🩺", name: "Medical aids", hint: "Wheelchairs", tint: "bg-mint-t" },
  { slug: "tools", icon: "🔧", name: "Tools", hint: "Hardware", tint: "bg-butter-t" },
  { slug: "office", icon: "🏭", name: "Office surplus", hint: "Bulk, packaging", tint: "bg-lavender-t" },
  { slug: "scrap", icon: "♻️", name: "Scrap", hint: "For recyclers", tint: "bg-lime-t" },
  { slug: "other", icon: "📦", name: "Anything else", hint: "Just snap it", tint: "bg-coral-t" },
];
