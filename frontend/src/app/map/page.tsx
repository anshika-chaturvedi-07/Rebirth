"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Search } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageShell } from "@/components/layout/PageShell";
import { StageChip, tileFor } from "@/components/listings/ListingCard";
import { ClayMap, type ClayMapHandle } from "@/components/map/ClayMap";
import { listingMarker, meMarker, needMarker } from "@/components/map/pins";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatQty, URGENCY } from "@/lib/format";
import { formatDistance, useUserLocation, type LatLng } from "@/lib/geo";
import type { Listing, Need, Stage } from "@/lib/types";

const RADII = [2, 5, 10, 25];
type Layer = "items" | "needs";

export default function MapPage() {
  const { user, loading: authLoading } = useAuth();
  const { location, source, locating, error: locError, locate, fallbackToCity } = useUserLocation();
  const [center, setCenter] = useState<LatLng | null>(null);
  const [pendingCenter, setPendingCenter] = useState<LatLng | null>(null);
  const [radius, setRadius] = useState(5);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ items: true, needs: true });
  const [stage, setStage] = useState<Stage | "all">("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<ClayMapHandle>(null);

  // initial position: the user's city (no permission prompt until they press "Use my location")
  useEffect(() => {
    if (!authLoading && !location) fallbackToCity(user?.city);
  }, [authLoading, location, user?.city, fallbackToCity]);

  useEffect(() => {
    if (location) {
      setCenter(location);
      setPendingCenter(null);
    }
  }, [location]);

  useEffect(() => {
    if (!center) return;
    const q = `near_lat=${center.lat.toFixed(5)}&near_lng=${center.lng.toFixed(5)}&radius_km=${radius}&sort=distance&limit=300`;
    let stale = false;
    setLoading(true);
    Promise.all([
      api<{ items: Listing[] }>(`/api/listings?${q}${stage !== "all" ? `&stage=${stage}` : ""}`),
      api<Need[]>(`/api/needs?${q}`),
    ])
      .then(([l, n]) => {
        if (stale) return;
        setListings(l.items);
        setNeeds(n);
        setError(null);
      })
      .catch((e) => !stale && setError((e as Error).message))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [center, radius, stage]);

  const markers = useMemo(() => {
    const out = [
      ...(layers.items ? listings.map(listingMarker) : []),
      ...(layers.needs ? needs.map(needMarker) : []),
    ].filter((m): m is NonNullable<typeof m> => m !== null);
    if (location && source === "device") out.push(meMarker(location));
    return out;
  }, [listings, needs, layers, location, source]);

  const nearby = useMemo(() => {
    const rows = [
      ...(layers.items ? listings.map((l) => ({ kind: "item" as const, id: `l-${l.id}`, d: l.distance_km ?? 0, l })) : []),
      ...(layers.needs ? needs.map((n) => ({ kind: "need" as const, id: `n-${n.id}`, d: n.distance_km ?? 0, n })) : []),
    ];
    return rows.sort((a, b) => a.d - b.d);
  }, [listings, needs, layers]);

  function focus(id: string, p: LatLng | null) {
    if (!p) return;
    mapRef.current?.flyTo(p, 14);
    setTimeout(() => mapRef.current?.openPopup(id), 450);
  }

  return (
    <PageShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-violet">Around you</p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold">Second chances on the map</h1>
          <p className="max-w-xl text-plum-soft">
            Round pins are items people are giving. Square pins are needs from schools, shelters and neighbours. Exact addresses are only shared once a request is accepted.
          </p>
        </div>
        <Button variant="lavender" size="sm" onClick={() => locate(user?.city)} disabled={locating}>
          <LocateFixed size={18} /> {locating ? "Finding you…" : "Use my location"}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="clay-sm flex gap-1 rounded-full bg-card p-1.5" role="group" aria-label="Search radius">
          {RADII.map((r) => (
            <button key={r} onClick={() => setRadius(r)} aria-pressed={radius === r}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${radius === r ? "clay-sm bg-lavender text-white" : "hover:bg-cream"}`}>
              {r} km
            </button>
          ))}
        </div>
        <div className="clay-sm flex gap-1 rounded-full bg-card p-1.5" role="group" aria-label="Show on map">
          {(["items", "needs"] as Layer[]).map((k) => (
            <button key={k} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))} aria-pressed={layers[k]}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${layers[k] ? (k === "items" ? "clay-sm bg-lime" : "clay-sm bg-coral text-white") : "hover:bg-cream"}`}>
              {k === "items" ? "🎁 Items" : "🙋 Needs"}
            </button>
          ))}
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value as Stage | "all")} aria-label="Item stage"
          className="clay-sm cursor-pointer rounded-full bg-card px-4 py-2 text-sm font-bold">
          <option value="all">All stages</option>
          <option value="free">Free first</option>
          <option value="marketplace">Marketplace</option>
          <option value="recycle">Repair &amp; recycle</option>
        </select>
        <span className="text-sm font-bold text-plum-soft" role="status">
          {loading ? "Looking around…" : `${listings.length} items · ${needs.length} needs within ${radius} km`}
        </span>
      </div>

      {locError && <p className="mb-3 rounded-2xl bg-butter-t px-4 py-2.5 text-sm font-bold">{locError}</p>}
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="clay relative h-[62vh] min-h-[420px] overflow-hidden rounded-[2rem]">
          {center && (
            <ClayMap
              ref={mapRef}
              center={center}
              zoom={radius <= 2 ? 14 : radius <= 5 ? 12.5 : radius <= 10 ? 11.5 : 10.3}
              markers={markers}
              radiusKm={radius}
              fitRadius
              onMoveEnd={(c) => setPendingCenter(c)}
              className="h-full w-full"
              label="Map of items and needs nearby"
            />
          )}
          {pendingCenter && (
            <button
              onClick={() => { setCenter(pendingCenter); setPendingCenter(null); }}
              className="clay-sm absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-extrabold"
            >
              <Search size={16} /> Search this area
            </button>
          )}
        </div>

        <aside className="clay-sm flex max-h-[62vh] min-h-[420px] flex-col rounded-[2rem] bg-card p-3" aria-label="Nearest first">
          <h2 className="px-2 pb-2 pt-1 text-lg font-bold">Nearest first</h2>
          {!loading && !nearby.length ? (
            <EmptyState title="Nothing in this circle yet">Try a bigger radius, or move the map and search that area.</EmptyState>
          ) : (
            <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {nearby.map((row) =>
                row.kind === "item" ? (
                  <li key={row.id}>
                    <button onClick={() => focus(row.id, row.l.lat != null && row.l.lng != null ? { lat: row.l.lat, lng: row.l.lng } : null)}
                      className="flex w-full min-w-0 items-center gap-3 rounded-2xl p-2 text-left hover:bg-cream">
                      <span className={`grid h-11 w-11 flex-none place-items-center rounded-2xl text-xl ${tileFor(row.l.category).tint}`} aria-hidden="true">{tileFor(row.l.category).icon}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{row.l.title}</b>
                        <small className="block truncate font-bold text-plum-soft">{formatDistance(row.l.distance_km)} · {formatQty(row.l.quantity, row.l.unit)}</small>
                      </span>
                      <StageChip stage={row.l.stage} />
                    </button>
                  </li>
                ) : (
                  <li key={row.id}>
                    <button onClick={() => focus(row.id, row.n.lat != null && row.n.lng != null ? { lat: row.n.lat, lng: row.n.lng } : null)}
                      className="flex w-full min-w-0 items-center gap-3 rounded-2xl p-2 text-left hover:bg-cream">
                      <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-coral-t text-xl" aria-hidden="true">🙋</span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{row.n.title}</b>
                        <small className="block truncate font-bold text-plum-soft">{formatDistance(row.n.distance_km)} · {row.n.requester.name}</small>
                      </span>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-extrabold ${URGENCY[row.n.urgency].chip}`}>{URGENCY[row.n.urgency].label}</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
          <Link href="/listings" className="mt-auto px-2 pt-2 text-sm font-bold text-violet hover:underline">Prefer a list? Browse all items →</Link>
        </aside>
      </div>
    </PageShell>
  );
}
