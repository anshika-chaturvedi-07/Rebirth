"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Character } from "@/components/characters/Character";
import { AnalyticsTabs, DemoDataNote } from "@/components/charts/AnalyticsTabs";
import { CategoryImpact, MonthlyImpact, StageSplit } from "@/components/charts/ImpactCharts";
import { CHART, kg, num } from "@/components/charts/theme";
import { PageShell } from "@/components/layout/PageShell";
import { ErrorNote, LoadingState } from "@/components/ui/EmptyState";
import type { CityImpact, ImpactTotals, MyImpact } from "@/lib/analyticsTypes";
import { useApi } from "@/lib/hooks";

function Tile({ label, value, note, tint }: { label: string; value: string; note?: string; tint: string }) {
  return (
    <div className={`clay-sm rounded-3xl px-4 py-3.5 ${tint}`}>
      <p className="text-sm font-bold text-plum-soft">{label}</p>
      <p className="mt-0.5 text-[1.75rem] font-extrabold leading-tight">{value}</p>
      {note && <p className="text-xs font-bold text-plum-soft">{note}</p>}
    </div>
  );
}

function Meter({ value }: { value: number }) {
  // fill = the accent; track = a lighter step of the same hue
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full" style={{ background: "#E9E1FB" }} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: CHART.single }} />
    </div>
  );
}

function YourImpact() {
  const { user } = useAuth();
  const { data } = useApi<MyImpact>(user ? "/api/impact/me" : null);
  if (!user || !data) return null;
  const parts: { label: string; t: ImpactTotals }[] = [
    { label: "You gave", t: data.given.total },
    { label: "You received", t: data.received.total },
    { label: "You delivered", t: data.delivered.total },
  ].filter((p) => p.t.handovers > 0);
  return (
    <section className="clay mt-8 flex flex-wrap items-center gap-5 overflow-hidden rounded-[2rem] bg-lime-t px-6 py-5" aria-label="Your impact">
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-extrabold">Your impact, {user.name.split(/[\s·]/)[0]}</h2>
        {parts.length ? (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {parts.map((p) => (
              <li key={p.label} className="rounded-2xl bg-white/70 px-3 py-2">
                <p className="text-sm font-bold text-plum-soft">{p.label}</p>
                <p className="font-extrabold">{kg(p.t.kg)} · {num(p.t.handovers)} handover{p.t.handovers === 1 ? "" : "s"}</p>
                <p className="text-xs font-bold text-plum-soft">{kg(p.t.co2e_kg)} CO₂e avoided{p.t.meals ? ` · ${num(p.t.meals)} meals` : ""}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-plum-soft">Once something you give, receive or deliver changes hands, your impact shows up here.</p>
        )}
      </div>
      <Character id="kabir" wave className="-mb-8 hidden w-32 flex-none self-end sm:block" />
    </section>
  );
}

export default function ImpactPage() {
  const { data, error, loading } = useApi<CityImpact>("/api/impact");

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-violet">Circular economy · {data?.city ?? "Bengaluru"}</p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold">What second chances add up to</h1>
        </div>
        <AnalyticsTabs active="impact" />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : loading || !data ? <LoadingState label="Adding it all up…" /> : (
        <>
          <section className="clay grid gap-5 rounded-[2.25rem] bg-card p-6 lg:grid-cols-[1.1fr_1.9fr]" aria-label="Headline impact">
            <div>
              <p className="font-bold text-plum-soft">CO₂e kept out of the air</p>
              {/* the one hero figure: same sans as the body, proportional digits */}
              <p className="font-sans text-[clamp(3rem,7vw,4.5rem)] font-extrabold leading-none text-plum">{kg(data.total.co2e_kg)}</p>
              <p className="mt-2 text-sm font-semibold text-plum-soft">
                About <b className="text-plum">{num(data.total.car_km_avoided)} km</b> not driven by car, or what
                {" "}<b className="text-plum">{num(Math.round(data.total.tree_years))} trees</b> absorb in a year.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Given a second life" value={kg(data.total.kg)} tint="bg-lime-t" />
              <Tile label="Meals rescued" value={num(data.total.meals)} tint="bg-coral-t" />
              <Tile label="Handovers" value={num(data.total.handovers)} tint="bg-sky-t" />
              <Tile label="Water saved" value={`${num(data.total.water_l / 1000)} kL`} note="embodied in the goods" tint="bg-blush-t" />
            </div>
          </section>

          <section className="clay-sm mt-5 rounded-[1.75rem] bg-card p-5" aria-label="Where items found a home">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold">Where items found a new home</h2>
              <p className="text-sm font-bold text-plum-soft">
                <b className="text-lg text-plum">{Math.round(data.rehome_rate * 100)}%</b> of everything listed was handed on rather than thrown away
              </p>
            </div>
            <StageSplit stages={data.stages} />
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <MonthlyImpact data={data.by_month} />
            <CategoryImpact data={data.by_category} />
          </div>

          <section className="clay-sm mt-5 rounded-[1.75rem] bg-card p-5" aria-label="Neighbourhood circularity">
            <h2 className="text-xl font-bold">Neighbourhood circularity</h2>
            <p className="text-sm font-semibold text-plum-soft">
              Score out of 100 = 70% “share of listed items that found a home” + 30% “share that went free to people in need”.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-plum-soft">
                    <th className="py-2 pr-3 font-extrabold">Area</th>
                    <th className="py-2 pr-3 font-extrabold">Circularity</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Found a home</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Went free</th>
                    <th className="py-2 pr-3 text-right font-extrabold">Reused</th>
                    <th className="py-2 text-right font-extrabold">CO₂e avoided</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.neighbourhoods.slice(0, 12).map((n) => (
                    <tr key={n.area} className="border-t border-cream-2">
                      <td className="py-2 pr-3 font-bold">{n.area}</td>
                      <td className="py-2 pr-3"><span className="flex items-center gap-2"><Meter value={n.circularity} /><b>{n.circularity}</b></span></td>
                      <td className="py-2 pr-3 text-right font-semibold">{Math.round(n.rehome_rate * 100)}%</td>
                      <td className="py-2 pr-3 text-right font-semibold">{Math.round(n.free_share * 100)}%</td>
                      <td className="py-2 pr-3 text-right font-semibold">{kg(n.kg)}</td>
                      <td className="py-2 text-right font-semibold">{kg(n.co2e_kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <YourImpact />
          <DemoDataNote />
        </>
      )}
    </PageShell>
  );
}
