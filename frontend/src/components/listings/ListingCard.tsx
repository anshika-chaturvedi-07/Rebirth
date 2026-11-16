import Link from "next/link";
import { CATEGORY_TILES } from "@/lib/categories";
import { formatINR, formatQty, STAGE_META, timeLeft } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import type { Listing } from "@/lib/types";

export const tileFor = (slug: string) => CATEGORY_TILES.find((c) => c.slug === slug) ?? CATEGORY_TILES[CATEGORY_TILES.length - 1];

export function StageChip({ stage }: { stage: Listing["stage"] }) {
  const m = STAGE_META[stage];
  return <span className={`flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${m.chip}`}>{m.label}</span>;
}

export function ListingCard({ listing }: { listing: Listing }) {
  const tile = tileFor(listing.category);
  const left = timeLeft(listing.stage_ends_at);
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="clay group flex min-w-0 flex-col rounded-[2rem] bg-card p-4 transition-transform duration-200 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-1.5"
    >
      <div className={`relative grid h-32 place-items-center rounded-3xl ${tile.tint}`}>
        <span className="text-6xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" aria-hidden="true">{tile.icon}</span>
        <span className="absolute left-3 top-3"><StageChip stage={listing.stage} /></span>
        {listing.stage === "marketplace" && listing.price_inr != null && (
          <span className="absolute right-3 top-3 rounded-full bg-card px-2.5 py-1 text-xs font-extrabold">{formatINR(listing.price_inr)}</span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-bold">{listing.title}</h3>
      <p className="mt-0.5 text-sm font-bold text-plum-soft">
        {formatQty(listing.quantity, listing.unit)} · {listing.area || listing.city}
        {listing.distance_km != null && <span className="text-violet"> · {formatDistance(listing.distance_km)}</span>}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs font-bold text-plum-soft">
        <span className="truncate">by {listing.donor.name}</span>
        {left && <span className="flex-none rounded-full bg-cream px-2 py-0.5">{left}</span>}
      </div>
    </Link>
  );
}
