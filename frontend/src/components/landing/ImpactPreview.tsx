"use client";

import { motion } from "framer-motion";
import { Character } from "@/components/characters/Character";
import { Button } from "@/components/ui/Button";
import { burstConfetti } from "@/lib/confetti";
import { SectionHead } from "./SectionHead";

const STATS = [
  { icon: "🍲", label: "Food rescued", value: "1,248 kg", note: "+18% this week", bg: "bg-coral-t", ic: "bg-coral" },
  { icon: "🌱", label: "CO₂e avoided", value: "3.1 t", note: "≈ 18,200 km not driven", bg: "bg-lime-t", ic: "bg-lime" },
  { icon: "🍛", label: "Meals served", value: "2,970", note: "+412 this week", bg: "bg-butter-t", ic: "bg-butter" },
  { icon: "🔥", label: "Giving streak", value: "21 days", note: "Personal best", bg: "bg-sky-t", ic: "bg-sky" },
];

const WEEK = [
  { d: "Mon", kg: 52, c: "bg-lavender" }, { d: "Tue", kg: 70, c: "bg-blush" }, { d: "Wed", kg: 44, c: "bg-coral" },
  { d: "Thu", kg: 88, c: "bg-butter" }, { d: "Fri", kg: 58, c: "bg-lime" }, { d: "Sat", kg: 96, c: "bg-sky" }, { d: "Sun", kg: 66, c: "bg-lavender" },
];
const MAX_KG = 100;

const SPLIT = [
  { label: "Shelters", pct: 34, color: "#FF8C73" },
  { label: "Kitchens", pct: 18, color: "#74CCEC" },
  { label: "Schools", pct: 16, color: "#B39DF5" },
  { label: "Individuals", pct: 16, color: "#C2EF6B" },
  { label: "Marketplace", pct: 16, color: "#FFD66B" },
];

function conic() {
  let acc = 0;
  return `conic-gradient(${SPLIT.map((s) => `${s.color} ${acc}% ${(acc += s.pct)}%`).join(", ")})`;
}

export function ImpactPreview() {
  return (
    <section id="impact" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6">
      <SectionHead kicker="Inside the app" title="Your impact, in colour">
        Here&apos;s what a restaurant owner sees on her donor dashboard after a busy week. Sample data.
      </SectionHead>

      <div className="clay grid gap-4.5 rounded-[2.5rem] bg-lavender-t p-4.5 md:grid-cols-[220px_1fr]">
        <aside className="flex flex-row flex-wrap items-center gap-1.5 rounded-[1.9rem] bg-lavender p-4 text-white md:flex-col md:items-stretch">
          <div className="mb-2 hidden text-center md:block">
            <div className="mx-auto flex h-[92px] w-[92px] items-end justify-center overflow-hidden rounded-full border-4 border-white bg-coral-t">
              <Character id="meera" className="-mb-4 w-[120%] max-w-none" />
            </div>
            <b className="mt-1.5 block font-display text-xl">Hi, Meera! 👋</b>
            <small>Spice Route Kitchen</small>
          </div>
          {["🏠 Dashboard", "📦 My listings", "🤝 Handovers", "📈 Impact report", "⚙️ Settings"].map((item, i) => (
            <span key={item} className={`rounded-2xl px-3.5 py-2.5 font-bold ${i === 0 ? "clay-sm bg-card text-plum" : ""}`}>{item}</span>
          ))}
          <div className="mt-auto hidden rounded-[1.4rem] bg-blush p-3.5 text-center text-sm font-bold text-plum md:block">
            <div className="text-3xl">🏅</div>Food Hero · Level 4
            <br />
            <small>3 donations to Level 5</small>
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          <div className="clay-sm relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] bg-card px-5 py-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.7rem] font-bold">Good evening, Meera! 🌙</h3>
              <p className="text-plum-soft">Tonight&apos;s 25 kg of biryani can feed Hope Night Shelter. Ravi is 8 minutes away.</p>
              <Button variant="coral" size="sm" className="mt-2.5" onClick={(e) => burstConfetti(e.currentTarget)}>Confirm pickup</Button>
            </div>
            <Character id="ravi" wave className="-mb-6 hidden w-[120px] flex-none self-end sm:block" />
          </div>

          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className={`clay-sm rounded-3xl px-4 py-3.5 ${s.bg}`}>
                <div className={`grid h-[38px] w-[38px] place-items-center rounded-[13px] text-lg ${s.ic}`}>{s.icon}</div>
                <small className="mt-2 block text-[0.8rem] font-bold text-plum-soft">{s.label}</small>
                <b className="font-display text-[1.75rem] leading-tight tabular-nums">{s.value}</b>
                <p className="text-xs font-extrabold text-[#3E9B3A]">{s.note}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3.5 lg:grid-cols-[1.5fr_1fr]">
            <div className="clay-sm min-w-0 rounded-[1.6rem] bg-card px-4.5 py-4">
              <h4 className="mb-2.5 text-lg font-bold">Kg donated this week</h4>
              <div className="flex h-[150px] items-end gap-2.5 pt-1.5" role="img" aria-label="Bar chart of kilograms donated each day this week">
                {WEEK.map((w, i) => (
                  <div key={w.d} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <motion.span
                      initial={{ scaleY: 0.1 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 120, damping: 12, delay: i * 0.05 }}
                      style={{ height: `${(w.kg / MAX_KG) * 100}%`, transformOrigin: "bottom" }}
                      className={`w-full max-w-[34px] rounded-t-xl rounded-b-lg shadow-[inset_0_-4px_0_rgb(61_44_90/0.1),inset_0_3px_5px_rgb(255_255_255/0.6)] ${w.c}`}
                      title={`${w.kg} kg`}
                    />
                    <span className="text-xs font-bold text-plum-soft">{w.d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="clay-sm min-w-0 rounded-[1.6rem] bg-card px-4.5 py-4">
              <h4 className="mb-2.5 text-lg font-bold">Where it went</h4>
              <div className="flex flex-wrap items-center gap-3.5">
                <div className="clay-sm relative h-[120px] w-[120px] flex-none rounded-full" style={{ background: conic() }} aria-hidden="true">
                  <div className="clay-inset absolute inset-7 rounded-full bg-card" />
                </div>
                <ul className="grid gap-1 text-sm font-bold">
                  {SPLIT.map((s) => (
                    <li key={s.label} className="flex items-center gap-1.5">
                      <i className="inline-block h-2.5 w-2.5 rounded" style={{ background: s.color }} />
                      {s.label} · {s.pct}%
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
