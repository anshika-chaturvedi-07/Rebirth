"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from "maplibre-gl";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { circleRing, type LatLng } from "@/lib/geo";

// Free vector tiles, no API key (https://openfreemap.org). Repainted below in the REBIRTH palette.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const PALETTE = {
  background: "#FFF7EC",
  water: "#BDE8F6",
  park: "#DDF5C4",
  building: "#F6E6D2",
  road: "#FFFFFF",
};

/** Recolour the base map so it matches the clay-world palette. */
function paint(style: StyleSpecification): StyleSpecification {
  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();
    if (layer.type === "background") layer.paint = { ...layer.paint, "background-color": PALETTE.background };
    else if (layer.type === "fill") {
      const color =
        id.includes("water") ? PALETTE.water
        : id.includes("park") || id.includes("landcover") || id.includes("wood") || id.includes("grass") ? PALETTE.park
        : id.includes("building") ? PALETTE.building
        : null;
      if (color) layer.paint = { ...layer.paint, "fill-color": color };
    } else if (layer.type === "line" && id.includes("water")) {
      layer.paint = { ...layer.paint, "line-color": PALETTE.water };
    }
  }
  return style;
}

export interface MapMarker extends LatLng {
  id: string;
  /** Builds the marker element. Use textContent for any user-provided text. */
  element: () => HTMLElement;
  /** Builds popup content (DOM, never HTML strings). */
  popup?: () => HTMLElement;
}

export interface ClayMapHandle {
  flyTo: (p: LatLng, zoom?: number) => void;
  openPopup: (id: string) => void;
  getCenter: () => LatLng | null;
}

interface ClayMapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  radiusKm?: number | null;
  /** Zoom so the whole radius circle is visible whenever it changes. */
  fitRadius?: boolean;
  /** A route line as [lng, lat] points; the map frames it when it changes. */
  route?: [number, number][] | null;
  /** A draggable pin; fires onPinMove when dropped. */
  pin?: LatLng | null;
  onPinMove?: (p: LatLng) => void;
  onMoveEnd?: (center: LatLng) => void;
  className?: string;
  interactive?: boolean;
  label?: string;
}

export const ClayMap = forwardRef<ClayMapHandle, ClayMapProps>(function ClayMap(
  { center, zoom = 12, markers = [], radiusKm, fitRadius = false, route, pin, onPinMove, onMoveEnd, className, interactive = true, label = "Map" },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markerRefs = useRef(new Map<string, MlMarker>());
  const pinRef = useRef<MlMarker | null>(null);
  const callbacks = useRef({ onPinMove, onMoveEnd });
  callbacks.current = { onPinMove, onMoveEnd };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // create the map once
  useEffect(() => {
    let cancelled = false;
    const markersOnMap = markerRefs.current;
    (async () => {
      const lib = await import("maplibre-gl");
      let style: StyleSpecification | string = STYLE_URL;
      try {
        style = paint(await (await fetch(STYLE_URL)).json());
      } catch {
        /* fall back to the unpainted style URL */
      }
      if (cancelled || !container.current) return;
      libRef.current = lib;
      const map = new lib.Map({
        container: container.current,
        style,
        center: [center.lng, center.lat],
        zoom,
        interactive,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      if (interactive) map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");      map.on("error", (e) => {
        if (!map.loaded() && (e.error as Error)?.message?.includes("Failed to fetch")) setFailed(true);
      });
      map.on("moveend", (e) => {
        if ((e as { originalEvent?: unknown }).originalEvent) {
          const c = map.getCenter();
          callbacks.current.onMoveEnd?.({ lat: c.lat, lng: c.lng });
        }
      });
      map.on("load", () => {
        map.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#B39DF5", "fill-opacity": 0.12 } });
        map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#8C6BEA", "line-width": 2, "line-dasharray": [2, 2] } });
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 9 } });
        map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8C6BEA", "line-width": 5 } });
        setReady(true);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersOnMap.clear();
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; center/zoom changes go through flyTo below
  }, []);

  // follow center changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (fitRadius && radiusKm) return; // the radius effect frames the map
    const c = map.getCenter();
    if (Math.abs(c.lat - center.lat) > 1e-5 || Math.abs(c.lng - center.lng) > 1e-5) {
      map.flyTo({ center: [center.lng, center.lat], speed: 1.4 });
    }
  }, [center.lat, center.lng, ready, fitRadius, radiusKm]);

  // search radius circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("radius") as import("maplibre-gl").GeoJSONSource | undefined;
    const ring = radiusKm ? circleRing(center, radiusKm) : null;
    src?.setData({
      type: "FeatureCollection",
      features: ring ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] : [],
    });
    if (ring && fitRadius) {
      const lngs = ring.map((p) => p[0]);
      const lats = ring.map((p) => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 24, duration: 600 });
    }
  }, [center, radiusKm, ready, fitRadius]);

  // route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("route") as import("maplibre-gl").GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: route && route.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }] : [],
    });
    if (route && route.length > 1) {
      const lngs = route.map((p) => p[0]);
      const lats = route.map((p) => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 50, duration: 700 });
    }
  }, [route, ready]);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = markerRefs.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
        continue;
      }
      const marker = new lib.Marker({ element: m.element(), anchor: "bottom" }).setLngLat([m.lng, m.lat]);
      if (m.popup) marker.setPopup(new lib.Popup({ offset: 30, closeButton: true, maxWidth: "260px" }).setDOMContent(m.popup()));
      marker.addTo(map);
      markerRefs.current.set(m.id, marker);
    }
    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers, ready]);

  // draggable pin
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    if (!pin) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      const el = document.createElement("div");
      el.className = "rb-pin rb-pin-drop";
      el.textContent = "📍";
      el.setAttribute("aria-label", "Drag to set the location");
      const marker = new lib.Marker({ element: el, draggable: true, anchor: "bottom" }).setLngLat([pin.lng, pin.lat]).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        callbacks.current.onPinMove?.({ lat: p.lat, lng: p.lng });
      });
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        callbacks.current.onPinMove?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      pinRef.current = marker;
    } else {
      pinRef.current.setLngLat([pin.lng, pin.lat]);
    }
  }, [pin, ready]);

  useImperativeHandle(ref, () => ({
    flyTo: (p, z) => mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: z ?? mapRef.current.getZoom(), speed: 1.4 }),
    openPopup: (id) => {
      const marker = markerRefs.current.get(id);
      if (!marker) return;
      for (const [, other] of markerRefs.current) if (other.getPopup()?.isOpen()) other.togglePopup();
      if (!marker.getPopup()?.isOpen()) marker.togglePopup();
    },
    getCenter: () => {
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    },
  }));

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {/* explicit size: maplibre's CSS forces position:relative on this element */}
      <div ref={container} className="h-full w-full" role="region" aria-label={label} />
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center bg-sky-t font-bold text-plum-soft">Unfolding the map…</div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-sky-t p-6 text-center font-bold">
          The map couldn&apos;t load. Check your internet connection. The list still works.
        </div>
      )}
    </div>
  );
});
