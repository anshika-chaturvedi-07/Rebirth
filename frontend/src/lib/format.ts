import type { Role, Stage } from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const formatINR = (n: number) => inr.format(n);

export function formatQty(q: number, unit: string) {
  const n = Number.isInteger(q) ? q.toLocaleString("en-IN") : q.toFixed(1);
  if (unit === "items") return `${n} ${q === 1 ? "item" : "items"}`;
  return `${n} ${unit}`;
}

/** "3 h left", "2 days left", "45 min left" */
export function timeLeft(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "ending now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h left`;
  return `${Math.round(hours / 24)} days left`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const STAGE_META: Record<Stage, { label: string; chip: string; tint: string }> = {
  free: { label: "Free · priority", chip: "bg-lime", tint: "bg-lime-t" },
  marketplace: { label: "Marketplace", chip: "bg-sky", tint: "bg-sky-t" },
  recycle: { label: "Repair / recycle", chip: "bg-lavender text-white", tint: "bg-lavender-t" },
  expired: { label: "Expired", chip: "bg-cream-2", tint: "bg-cream-2" },
};

export const ROLE_LABEL: Record<Role, string> = {
  donor: "Donor",
  organisation: "NGO / school",
  individual: "Individual",
  volunteer: "Volunteer",
  business: "Business",
  recycler: "Repairer / recycler",
  admin: "Admin",
};

export const CONDITION_LABEL = { new: "New", good: "Good", fair: "Fair", needs_repair: "Needs repair" } as const;

export const URGENCY = {
  1: { label: "When possible", chip: "bg-mint-t" },
  2: { label: "Soon", chip: "bg-butter" },
  3: { label: "Urgent", chip: "bg-coral text-white" },
} as const;
