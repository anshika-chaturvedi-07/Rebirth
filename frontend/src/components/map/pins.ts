import { tileFor } from "@/components/listings/ListingCard";
import { formatDistance } from "@/lib/geo";
import { formatINR, formatQty, STAGE_META, URGENCY } from "@/lib/format";
import type { Listing, Need } from "@/lib/types";
import type { MapMarker } from "./ClayMap";

const STAGE_PIN: Record<Listing["stage"], string> = {
  free: "#9ADB3C", marketplace: "#74CCEC", recycle: "#B39DF5", expired: "#D8CFC2",
};
const URGENCY_PIN = { 1: "#9FE3C9", 2: "#FFD66B", 3: "#FF8C73" } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text; // textContent: user text is never parsed as HTML
  return e;
}

function popupShell(title: string, lines: string[], chip: { text: string; className: string }, href: string, cta: string) {
  const root = el("div", "grid gap-1.5");
  root.append(el("span", `w-fit rounded-full px-2 py-0.5 text-[11px] font-extrabold ${chip.className}`, chip.text));
  root.append(el("b", "font-display text-base leading-tight", title));
  for (const line of lines) root.append(el("span", "text-xs font-bold text-plum-soft", line));
  const a = el("a", "mt-1 w-fit rounded-full bg-coral px-3 py-1 text-xs font-extrabold text-white", cta);
  a.setAttribute("href", href);
  root.append(a);
  return root;
}

export function listingMarker(l: Listing): MapMarker | null {
  if (l.lat == null || l.lng == null) return null;
  return {
    id: `l-${l.id}`,
    lat: l.lat,
    lng: l.lng,
    element: () => {
      const pin = el("div", "rb-pin");
      pin.style.setProperty("--pin", STAGE_PIN[l.stage]);
      pin.setAttribute("role", "button");
      pin.setAttribute("aria-label", `${l.title}, ${STAGE_META[l.stage].label}`);
      pin.append(el("span", "", tileFor(l.category).icon));
      return pin;
    },
    popup: () =>
      popupShell(
        l.title,
        [
          [formatQty(l.quantity, l.unit), l.area || l.city].join(" · "),
          [formatDistance(l.distance_km), l.stage === "marketplace" && l.price_inr != null ? formatINR(l.price_inr) : null].filter(Boolean).join(" · "),
        ].filter(Boolean),
        { text: STAGE_META[l.stage].label, className: STAGE_META[l.stage].chip },
        `/listings/${l.id}`,
        "View item →",
      ),
  };
}

export function needMarker(n: Need): MapMarker | null {
  if (n.lat == null || n.lng == null) return null;
  return {
    id: `n-${n.id}`,
    lat: n.lat,
    lng: n.lng,
    element: () => {
      const pin = el("div", "rb-pin rb-pin-need");
      pin.style.setProperty("--pin", URGENCY_PIN[n.urgency]);
      pin.setAttribute("role", "button");
      pin.setAttribute("aria-label", `Need: ${n.title}`);
      pin.append(el("span", "", "🙋"));
      return pin;
    },
    popup: () =>
      popupShell(
        n.title,
        [n.requester.name, [`Needs ${formatQty(n.quantity, n.unit)}`, formatDistance(n.distance_km)].filter(Boolean).join(" · ")],
        { text: `${tileFor(n.category).icon} ${URGENCY[n.urgency].label}`, className: URGENCY[n.urgency].chip },
        "/listings/new",
        "I can help →",
      ),
  };
}

export function stopMarker(
  n: number,
  stop: { task_id: number; kind: "pickup" | "dropoff"; lat: number; lng: number; label: string; item: string; leg_km: number },
): MapMarker {
  return {
    id: `stop-${n}-${stop.task_id}-${stop.kind}`, // new id when a re-plan changes the stop, so the pin is redrawn
    lat: stop.lat,
    lng: stop.lng,
    element: () => {
      const pin = el("div", `rb-stop ${stop.kind === "pickup" ? "rb-stop-pickup" : "rb-stop-drop"}`, String(n));
      pin.setAttribute("role", "button");
      pin.setAttribute("aria-label", `Stop ${n}: ${stop.kind === "pickup" ? "pick up" : "drop off"} ${stop.item}`);
      return pin;
    },
    popup: () => {
      const root = el("div", "grid gap-1");
      root.append(el("span", `w-fit rounded-full px-2 py-0.5 text-[11px] font-extrabold ${stop.kind === "pickup" ? "bg-lime" : "bg-coral text-white"}`,
        `Stop ${n} · ${stop.kind === "pickup" ? "Pick up" : "Drop off"}`));
      root.append(el("b", "font-display text-base leading-tight", stop.item));
      root.append(el("span", "text-xs font-bold text-plum-soft", stop.label));
      root.append(el("span", "text-xs font-bold text-plum-soft", `${stop.leg_km.toFixed(1)} km from the previous stop`));
      return root;
    },
  };
}

export function meMarker(p: { lat: number; lng: number }): MapMarker {
  return {
    id: "me",
    ...p,
    element: () => {
      const dot = el("div", "rb-me");
      dot.setAttribute("aria-label", "You are here");
      return dot;
    },
  };
}
