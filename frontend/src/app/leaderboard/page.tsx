"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AnalyticsTabs, DemoDataNote } from "@/components/charts/AnalyticsTabs";
import { kg } from "@/components/charts/theme";
import { PageShell } from "@/components/layout/PageShell";
import { LoadingState } from "@/components/ui/EmptyState";
import { ROLE_LABEL } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Role } from "@/lib/types";

interface Board {
  days: number;
  givers: { user_id: number; name: string; role: Role; verified: boolean; co2e_kg: number; kg: number; handovers: number }[];
  volunteers: { user_id: number; name: string; deliveries: number }[];
  neighbourhoods: { area: string; co2e_kg: number; handovers: number }[];
}
interface Badge { code: string; name: string; icon: string; description: string; progress: number; earned: boolean }

const MEDAL = ["🥇", "🥈", "🥉"];

function MyBadges() {
  const { user } = useAuth();
  const { data } = useApi<Badge[]>(user ? "/api/me/badges" : null);
  if (!user || !data) return null;
  return (
    <section className="clay mb-6 rounded-[2rem] bg-butter-t p-5" aria-label="Your badges">
      <h2 className="text-xl font-extrabold">Your badges</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {data.map((b) => (
          <li key={b.code} className={`rounded-3xl p-3 text-center ${b.earned ? "clay-sm bg-card" : "bg-white/50"}`} title={b.description}>
            <span className={`block text-3xl ${b.earned ? "" : "opacity-40 grayscale"}`} aria-hidden="true">{b.icon}</span>
            <b className="mt-1 block text-sm leading-tight">{b.name}</b>
            <span className="block text-[11px] font-semibold text-plum-soft">{b.description}</span>
            {!b.earned && (
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-cream-2" aria-label={`${Math.round(b.progress * 100)}% there`}>
                <span className="block h-full rounded-full bg-[#7B5BE0]" style={{ width: `${b.progress * 100}%` }} />
              </span>
            )}
            {b.earned && <span className="mt-1 block text-[11px] font-extrabold text-[#3E9B3A]">Earned</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LeaderboardPage() {
  const [days, setDays] = useState(90);
  const { data } = useApi<Board>(`/api/leaderboard?days=${days}`);

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-violet">Community</p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold">Leaderboard</h1>
          <p className="max-w-xl text-plum-soft">Celebrating the people and places giving the most second chances. People who <i>receive</i> help are never ranked.</p>
        </div>
        <AnalyticsTabs active="leaderboard" />
      </div>
      <MyBadges />
      <div className="mb-4 flex gap-1 rounded-full bg-card p-1.5 clay-sm w-fit" role="group" aria-label="Period">
        {[30, 90, 365].map((d) => (
          <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${days === d ? "clay-sm bg-lavender text-white" : "hover:bg-cream"}`}>
            {d === 365 ? "This year" : `Last ${d} days`}
          </button>
        ))}
      </div>
      {!data ? <LoadingState /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="clay-sm rounded-[1.75rem] bg-card p-5 lg:col-span-2" aria-label="Top givers">
            <h2 className="text-xl font-bold">🌍 Top givers <span className="text-sm text-plum-soft">by CO₂e avoided</span></h2>
            <ol className="mt-3 grid gap-2">
              {data.givers.map((g, i) => (
                <li key={g.user_id} className="flex items-center gap-3 rounded-2xl bg-cream px-3 py-2.5">
                  <span className="w-8 text-center font-display text-xl font-extrabold" aria-label={`Rank ${i + 1}`}>{MEDAL[i] ?? i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/u/${g.user_id}`} className="flex items-center gap-1 font-bold hover:underline">
                      {g.name}{g.verified && <BadgeCheck size={15} className="text-violet" aria-label="Verified" />}
                    </Link>
                    <small className="font-bold text-plum-soft">{ROLE_LABEL[g.role]} · {g.handovers} handovers · {kg(g.kg)} reused</small>
                  </span>
                  <b className="tabular-nums">{kg(g.co2e_kg)}</b>
                </li>
              ))}
            </ol>
          </section>
          <div className="grid h-fit gap-5">
            <section className="clay-sm rounded-[1.75rem] bg-card p-5" aria-label="Top volunteers">
              <h2 className="text-xl font-bold">🚚 Volunteers</h2>
              {!data.volunteers.length ? <p className="mt-1 text-sm font-semibold text-plum-soft">No deliveries in this period yet.</p> : (
                <ol className="mt-2 grid gap-1.5">
                  {data.volunteers.map((v, i) => (
                    <li key={v.user_id} className="flex justify-between rounded-2xl bg-cream px-3 py-2 font-bold">
                      <span>{MEDAL[i] ?? `${i + 1}.`} {v.name}</span><span className="tabular-nums">{v.deliveries}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="clay-sm rounded-[1.75rem] bg-card p-5" aria-label="Top neighbourhoods">
              <h2 className="text-xl font-bold">🏘️ Neighbourhoods</h2>
              <ol className="mt-2 grid gap-1.5">
                {data.neighbourhoods.slice(0, 6).map((n, i) => (
                  <li key={n.area} className="flex justify-between rounded-2xl bg-cream px-3 py-2 text-sm font-bold">
                    <span>{MEDAL[i] ?? `${i + 1}.`} {n.area}</span><span className="tabular-nums">{kg(n.co2e_kg)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
      <DemoDataNote />
    </PageShell>
  );
}
