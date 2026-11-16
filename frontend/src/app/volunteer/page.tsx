"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Route as RouteIcon } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Character } from "@/components/characters/Character";
import { PageShell } from "@/components/layout/PageShell";
import { tileFor } from "@/components/listings/ListingCard";
import { ClayMap } from "@/components/map/ClayMap";
import { meMarker, stopMarker } from "@/components/map/pins";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/FormBits";
import { api } from "@/lib/api";
import { burstConfetti } from "@/lib/confetti";
import { formatQty } from "@/lib/format";
import { useUserLocation, type LatLng } from "@/lib/geo";
import type { Delivery, PlannedRoute, User } from "@/lib/types";

const STATUS_CHIP: Record<string, { label: string; chip: string }> = {
  open: { label: "Waiting", chip: "bg-butter" },
  assigned: { label: "Yours: go pick up", chip: "bg-sky" },
  picked_up: { label: "On board", chip: "bg-lavender text-white" },
  delivered: { label: "Delivered", chip: "bg-lime" },
  cancelled: { label: "Cancelled", chip: "bg-cream-2" },
};

function Planner({ user }: { user: User }) {
  const { location, source, locating, error: locError, locate, fallbackToCity } = useUserLocation();
  const [open, setOpen] = useState<Delivery[]>([]);
  const [mine, setMine] = useState<Delivery[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [maxTasks, setMaxTasks] = useState(4);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const takeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!location) fallbackToCity(user.city);
  }, [location, user.city, fallbackToCity]);

  const refresh = useCallback(async () => {
    if (!location) return;
    try {
      const [o, m] = await Promise.all([
        api<Delivery[]>(`/api/deliveries?near_lat=${location.lat.toFixed(5)}&near_lng=${location.lng.toFixed(5)}&radius_km=25`),
        api<Delivery[]>("/api/deliveries?scope=mine"),
      ]);
      setOpen(o);
      setMine(m);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [location]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function planRoute() {
    if (!location) return;
    setBusy("plan");
    setError(null);
    try {
      setRoute(await api<PlannedRoute>("/api/deliveries/plan", {
        body: { start_lat: location.lat, start_lng: location.lng, task_ids: [...selected], max_tasks: maxTasks },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function takeRoute() {
    if (!route) return;
    const openIds = route.task_ids.filter((id) => open.some((t) => t.id === id));
    if (!openIds.length) return;
    setBusy("take");
    try {
      await api("/api/deliveries/assign", { body: { task_ids: openIds } });
      if (takeBtn.current) burstConfetti(takeBtn.current);
      setSelected(new Set());
      await refresh();
      await planRoute(); // re-plan with exact addresses now that they're yours
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function act(id: number, action: "pickup" | "deliver" | "release", el?: HTMLElement) {
    setBusy(`${action}-${id}`);
    try {
      await api(`/api/deliveries/${id}/${action}`, { method: "POST" });
      if (action === "deliver" && el) burstConfetti(el, 60);
      setRoute(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const start: LatLng | null = location;
  const markers = useMemo(() => {
    const out = route ? route.stops.map((s, i) => stopMarker(i + 1, s)) : [];
    if (start) out.push(meMarker(start));
    return out;
  }, [route, start]);
  const line = useMemo<[number, number][] | null>(
    () => (route && start ? [[start.lng, start.lat], ...route.stops.map((s) => [s.lng, s.lat] as [number, number])] : null),
    [route, start],
  );

  const active = mine.filter((t) => t.status === "assigned" || t.status === "picked_up");
  const done = mine.filter((t) => t.status === "delivered");
  const saved = route ? Math.max(0, route.naive_km - route.total_km) : 0;

  return (
    <>
      <div className="clay mb-6 flex flex-wrap items-center gap-5 overflow-hidden rounded-[2.25rem] bg-butter-t px-6 py-5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-violet">Volunteer deliveries</p>
          <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold">Plan your pickup run, {user.name.split(" ")[0]}</h1>
          <p className="max-w-xl text-plum-soft">
            We pick the nearest deliveries and work out the shortest order to visit them, always collecting an item before dropping it off.
          </p>
          <p className="mt-2 text-sm font-bold">🎉 {done.length} deliver{done.length === 1 ? "y" : "ies"} completed so far</p>
        </div>
        <Character id="ravi" wave className="-mb-8 hidden w-36 flex-none self-end sm:block" />
      </div>

      {locError && <p className="mb-3 rounded-2xl bg-butter-t px-4 py-2.5 text-sm font-bold">{locError}</p>}
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="sm" onClick={() => locate(user.city)} disabled={locating}>
              <LocateFixed size={16} /> {locating ? "Finding you…" : source === "device" ? "Update my location" : "Start from my location"}
            </Button>
            <label className="flex items-center gap-2 text-sm font-bold">
              Deliveries
              <Select value={maxTasks} onChange={(e) => setMaxTasks(Number(e.target.value))} className="w-auto py-2" aria-label="How many deliveries to plan">
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
            <Button size="sm" variant="lavender" onClick={planRoute} disabled={!location || busy === "plan" || (!open.length && !active.length)}>
              <RouteIcon size={16} /> {busy === "plan" ? "Optimising…" : selected.size ? `Plan ${selected.size} selected` : "Plan my route"}
            </Button>
            {source !== "device" && <span className="text-xs font-bold text-plum-soft">Starting from your city centre</span>}
          </div>

          <div className="clay relative h-[52vh] min-h-[380px] overflow-hidden rounded-[2rem]">
            {start && <ClayMap center={start} zoom={12} markers={markers} route={line} className="h-full w-full" label="Delivery route map" />}
          </div>

          {route && (
            <div className="clay-sm rounded-[1.75rem] bg-card p-4" role="status">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div><b className="font-display text-2xl">{route.total_km.toFixed(1)} km</b><small className="block font-bold text-plum-soft">total ride</small></div>
                <div><b className="font-display text-2xl">~{route.minutes} min</b><small className="block font-bold text-plum-soft">incl. {route.stops.length} stops</small></div>
                {saved > 0.05 && (
                  <div><b className="font-display text-2xl text-[#3E9B3A]">−{saved.toFixed(1)} km</b><small className="block font-bold text-plum-soft">vs. one at a time</small></div>
                )}
                <span className="rounded-full bg-lavender-t px-2.5 py-1 text-xs font-extrabold text-violet">Optimised with {route.solver === "or-tools" ? "Google OR-Tools" : "REBIRTH's route heuristic"}</span>
              </div>
              <ol className="mt-3 grid gap-1.5">
                {route.stops.map((s, i) => (
                  <li key={`${s.task_id}-${s.kind}`} className="flex items-center gap-2.5 text-sm">
                    <span className={`rb-stop flex-none !h-7 !w-7 !text-sm ${s.kind === "pickup" ? "rb-stop-pickup" : "rb-stop-drop"}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1"><b>{s.kind === "pickup" ? "Pick up" : "Drop off"}</b> {s.item} <span className="text-plum-soft">· {s.label}</span></span>
                    <span className="flex-none text-xs font-bold text-plum-soft">{s.leg_km.toFixed(1)} km</span>
                  </li>
                ))}
              </ol>
              {route.task_ids.some((id) => open.some((t) => t.id === id)) && (
                <Button ref={takeBtn} variant="coral" className="mt-3 w-full sm:w-auto" onClick={takeRoute} disabled={busy === "take"}>
                  {busy === "take" ? "Taking them…" : "🚚 Take these deliveries"}
                </Button>
              )}
              <p className="mt-2 text-xs font-semibold text-plum-soft">Distances are estimates (straight line × 1.35 for city roads, about 18 km/h in traffic).</p>
            </div>
          )}
        </div>

        <aside className="grid h-fit gap-4">
          <section className="clay-sm rounded-[1.75rem] bg-card p-4" aria-label="My deliveries">
            <h2 className="text-lg font-bold">My deliveries</h2>
            {!active.length ? (
              <p className="mt-1 text-sm font-semibold text-plum-soft">Nothing on your list yet. Plan a route and take some deliveries.</p>
            ) : (
              <ul className="mt-2 grid gap-2.5">
                {active.map((t) => (
                  <li key={t.id} className="rounded-2xl bg-cream p-3">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-sm">{tileFor(t.category).icon} {t.item}</b>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-extrabold ${STATUS_CHIP[t.status].chip}`}>{STATUS_CHIP[t.status].label}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-plum-soft">📍 {t.pickup.label}<br />🏁 {t.dropoff.label}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.status === "assigned" && (
                        <>
                          <Button size="sm" variant="lime" disabled={!!busy} onClick={() => act(t.id, "pickup")}>Picked up</Button>
                          <Button size="sm" disabled={!!busy} onClick={() => act(t.id, "release")}>Hand back</Button>
                        </>
                      )}
                      {t.status === "picked_up" && (
                        <Button size="sm" variant="coral" disabled={!!busy} onClick={(e) => act(t.id, "deliver", e.currentTarget)}>✅ Delivered</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="clay-sm rounded-[1.75rem] bg-card p-4" aria-label="Waiting for a volunteer">
            <h2 className="text-lg font-bold">Waiting nearby <span className="text-sm text-plum-soft">({open.length})</span></h2>
            <p className="text-xs font-semibold text-plum-soft">Tick some to plan just those, or let us pick the nearest. Exact addresses appear once you take a delivery.</p>
            {!open.length ? (
              <p className="mt-2 text-sm font-semibold text-plum-soft">No deliveries waiting within 25 km right now.</p>
            ) : (
              <ul className="mt-2 grid max-h-80 gap-2 overflow-y-auto pr-1">
                {open.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl p-2 hover:bg-cream">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#8C6BEA]" checked={selected.has(t.id)}
                        onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })} />
                      <span className="min-w-0 flex-1 text-sm">
                        <b className="block truncate">{tileFor(t.category).icon} {t.item}</b>
                        <span className="block text-xs font-bold text-plum-soft">
                          {formatQty(t.quantity, t.unit)} · {t.distance_km != null ? `${t.distance_km.toFixed(1)} km to pickup · ` : ""}{t.trip_km.toFixed(1)} km trip
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function VolunteerPage() {
  return (
    <PageShell>
      <RequireAuth>
        {(user) =>
          user.role === "volunteer" ? (
            <Planner user={user} />
          ) : (
            <EmptyState title="Deliveries are for volunteers" action={<ButtonLink href="/dashboard">Back to my dashboard</ButtonLink>}>
              Volunteers pick up items and bring them to NGOs, schools and neighbours. Create a volunteer account to join them.
            </EmptyState>
          )
        }
      </RequireAuth>
    </PageShell>
  );
}
