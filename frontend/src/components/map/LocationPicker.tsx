"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { api } from "@/lib/api";
import { useUserLocation, type LatLng, type Place } from "@/lib/geo";
import { Input, Label } from "@/components/ui/FormBits";
import { ClayMap } from "./ClayMap";

export interface PickedLocation extends LatLng {
  area: string;
  city: string;
}

/**
 * Area + city fields with locality autocomplete from the built-in gazetteer, "use my location",
 * and a draggable pin. Reports the chosen point through onChange.
 */
export function LocationPicker({ defaultCity, onChange, cityError }: { defaultCity: string; onChange: (p: PickedLocation | null) => void; cityError?: string }) {
  const [area, setArea] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { location, source, locating, error, locate, fallbackToCity } = useUserLocation();
  const listId = useId();
  const skipLookup = useRef(false);

  // start at the user's city
  useEffect(() => {
    fallbackToCity(defaultCity);
  }, [defaultCity, fallbackToCity]);

  useEffect(() => {
    if (!location) return;
    setPoint(location);
    if (source === "device") setNote("📍 Using your current location. Drag the pin if it's a little off.");
  }, [location, source]);

  // suggestions while typing an area
  useEffect(() => {
    if (skipLookup.current) {
      skipLookup.current = false;
      return;
    }
    const q = area.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      api<Place[]>(`/api/places?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`)
        .then((r) => { setSuggestions(r); setOpen(true); })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [area, city]);

  useEffect(() => {
    onChange(point ? { ...point, area: area.trim(), city: city.trim() } : null);
  }, [point, area, city, onChange]);

  function choose(p: Place) {
    skipLookup.current = true;
    setArea(p.kind === "locality" ? p.name : "");
    setCity(p.city);
    setPoint({ lat: p.lat, lng: p.lng });
    setOpen(false);
    setNote(`📍 Pinned to ${p.name}. Drag the pin to the exact spot if you like.`);
  }

  async function onCityBlur() {
    const p = await api<Place | null>(`/api/places/resolve?city=${encodeURIComponent(city)}&area=${encodeURIComponent(area)}`).catch(() => null);
    if (p && !area) setPoint({ lat: p.lat, lng: p.lng });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <Label htmlFor="area">Area / locality</Label>
          <Input
            id="area" name="area" value={area} maxLength={120} autoComplete="off" placeholder="Start typing, e.g. Koramangala"
            role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls={listId} aria-autocomplete="list"
            onChange={(e) => setArea(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && suggestions.length > 0 && (
            <ul id={listId} role="listbox" className="clay absolute inset-x-0 top-full z-20 mt-1 grid max-h-60 overflow-y-auto rounded-2xl bg-card p-1.5">
              {suggestions.map((s) => (
                <li key={`${s.city}-${s.name}`} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left font-semibold hover:bg-lavender-t">
                    <span>{s.kind === "city" ? "🏙️" : "📍"} {s.name}</span>
                    <small className="text-plum-soft">{s.kind === "city" ? "City" : s.city}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} onBlur={onCityBlur} aria-describedby="city-err" />
          {cityError && <p id="city-err" className="mt-1 text-sm font-bold text-[#D9534F]">{cityError}</p>}
        </div>
      </div>

      <div className="clay-sm relative h-56 overflow-hidden rounded-3xl">
        {point && (
          <ClayMap center={point} zoom={14} pin={point} onPinMove={(p) => { setPoint(p); setNote("📍 Pin moved. We'll show this spot rounded to about 100 m until you accept a request."); }}
            className="h-full w-full" label="Drag the pin to the pickup spot" />
        )}
        <button type="button" onClick={() => locate(city)} disabled={locating}
          className="clay-sm absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold">
          <LocateFixed size={16} /> {locating ? "Finding you…" : "Use my location"}
        </button>
      </div>
      <p className="text-sm font-semibold text-plum-soft" role="status">
        {error ?? note ?? "Tap the map or drag the pin to the pickup spot. Others only see it rounded to about 100 m."}
      </p>
    </div>
  );
}
