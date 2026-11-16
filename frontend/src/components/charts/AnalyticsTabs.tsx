import Link from "next/link";

export function AnalyticsTabs({ active }: { active: "impact" | "insights" | "leaderboard" }) {
  const tab = (href: string, id: string, label: string) => (
    <Link href={href} aria-current={active === id ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-bold ${active === id ? "clay-sm bg-lavender text-white" : "hover:bg-cream"}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Analytics" className="clay-sm inline-flex gap-1 rounded-full bg-card p-1.5">
      {tab("/impact", "impact", "🌱 Impact")}
      {tab("/insights", "insights", "🔮 Forecasts")}
      {tab("/leaderboard", "leaderboard", "🏆 Leaderboard")}
    </nav>
  );
}

export function DemoDataNote() {
  return (
    <p className="mt-8 rounded-2xl bg-butter-t px-4 py-3 text-sm font-semibold">
      ℹ️ <b>Demo data.</b> These figures come from three years of <b>simulated</b> Bengaluru activity plus anything done in the app.
      CO₂e, water and meal figures use indicative per-kilogram averages by category (see the README), not measured lifecycle data.
    </p>
  );
}
