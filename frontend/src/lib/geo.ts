"use client";

import { useCallback, useState } from "react";
import { api } from "./api";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  name: string;
  city: string;
  kind: "city" | "locality";
}

export const DEFAULT_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 }; // Bengaluru; the API's /api/region is the source of truth

export function formatDistance(km: number | null | undefined) {
  if (km == null) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/** Polygon ring approximating a circle, for drawing a search radius on the map. */
export function circleRing(center: LatLng, radiusKm: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + dLng * Math.cos(t), center.lat + dLat * Math.sin(t)]);
  }
  return ring;
}

export type LocationSource = "device" | "city" | "default";

/**
 * Where is the user? Tries the browser's location (with permission), then the user's city centre,
 * then the region default. Never throws; `error` explains a fallback in plain words.
 */
export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [source, setSource] = useState<LocationSource | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallback = useCallback(async (city?: string, reason?: string) => {
    if (reason) setError(reason);
    if (city) {
      const p = await api<Place | null>(`/api/places/resolve?city=${encodeURIComponent(city)}`).catch(() => null);
      if (p) {
        setLocation({ lat: p.lat, lng: p.lng });
        setSource("city");
        return;
      }
    }
    setLocation(DEFAULT_CENTER);
    setSource("default");
  }, []);

  const locate = useCallback(
    (city?: string) => {
      setError(null);
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        fallback(city, "Your browser can't share a location, so we're showing your city.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setSource("device");
          setLocating(false);
        },
        (err) => {
          setLocating(false);
          fallback(
            city,
            err.code === err.PERMISSION_DENIED
              ? "Location access is off, so we're showing your city centre. You can drag the map instead."
              : "We couldn't find your location, so we're showing your city centre.",
          );
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
      );
    },
    [fallback],
  );

  return { location, setLocation, source, setSource, locating, error, locate, fallbackToCity: fallback };
}
