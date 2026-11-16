"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Character } from "@/components/characters/Character";
import { Chhotu } from "@/components/characters/Chhotu";
import { Cloud } from "@/components/ui/Cloud";
import { Button, ButtonLink } from "@/components/ui/Button";
import { burstConfetti } from "@/lib/confetti";

const STATS = [
  { value: "18,420 kg", label: "rescued this month" },
  { value: "312", label: "NGOs & schools" },
  { value: "46 t", label: "CO₂e avoided" },
];

export function Hero() {
  // gentle parallax on the giant background word
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(useTransform(mx, [-0.5, 0.5], [-24, 24]), { stiffness: 60, damping: 15 });
  const y = useSpring(useTransform(my, [-0.5, 0.5], [-14, 14]), { stiffness: 60, damping: 15 });

  return (
    <section
      className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr]"
      onPointerMove={(e) => {
        mx.set(e.clientX / window.innerWidth - 0.5);
        my.set(e.clientY / window.innerHeight - 0.5);
      }}
    >
      <motion.div
        aria-hidden="true"
        style={{ x, y }}
        className="pointer-events-none absolute inset-x-0 top-[38%] -z-0 select-none text-center font-display text-[clamp(5rem,19vw,15rem)] font-extrabold leading-none tracking-wide text-lavender/20"
      >
        REBIRTH
      </motion.div>

      {/* copy */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
        <span className="clay-sm inline-flex items-center gap-2 rounded-full bg-lime px-4 py-1.5 text-[0.8rem] font-extrabold uppercase tracking-wider">
          🌍 A world where everything gets a second chance
        </span>
        <h1 className="mt-4 text-[clamp(2.8rem,6.2vw,5rem)] font-extrabold">
          Your old things,
          <br />
          <span className="text-coral">someone&apos;s</span> <span className="text-violet">new start.</span>
        </h1>
        <p className="mt-2 font-display text-[1.35rem] font-semibold text-plum-soft" lang="hi">हर चीज़ को दूसरा मौका</p>
        <p className="mt-4 max-w-xl text-lg text-plum-soft">
          Snap a photo of anything you don&apos;t need. REBIRTH finds a school, NGO or neighbour who does, and a volunteer to bring it there.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/signup" variant="coral">📸 Give something</ButtonLink>
          <ButtonLink href="/#categories">🔎 Find what you need</ButtonLink>
        </div>
        <dl className="mt-8 flex flex-wrap gap-7">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-[1.7rem] font-bold leading-none">{s.value}</dd>
              <dd className="text-sm font-bold text-plum-soft">{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-plum-soft/70">Sample figures for the prototype.</p>
      </motion.div>

      {/* stage */}
      <div className="relative flex min-h-[500px] items-end justify-center">
        <Cloud className="absolute right-[12%] top-0 w-28 animate-drift" />
        <Cloud className="absolute left-0 top-[30%] w-20 animate-drift [animation-delay:-4s]" />
        <div className="absolute inset-x-[6%] bottom-0 h-16 rounded-[50%] bg-lavender-t" />

        <div className="clay-sm absolute left-0 top-[30%] z-30 flex animate-bob items-center gap-2 rounded-full bg-card py-2 pl-2 pr-4 text-sm font-bold sm:-left-6">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-coral-t">🍲</span>Meera shared 25 kg biryani
        </div>
        <div className="clay-sm absolute right-0 top-[52%] z-30 flex animate-bob items-center gap-2 rounded-full bg-card py-2 pl-2 pr-4 text-sm font-bold [animation-delay:.8s] sm:-right-6">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-t">🌱</span>+120 kg CO₂e saved
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.15 }}
          className="relative z-20 mb-8 w-full max-w-[390px]"
        >
          {/* characters peek over the top edge of the card */}
          <div className="absolute bottom-[calc(100%-78px)] left-1 z-0 w-[190px] animate-bob">
            <Character id="aarav" className="w-full" />
          </div>
          <div className="absolute bottom-[calc(100%-40px)] right-0 z-20 w-[140px]">
            <Chhotu className="w-full" />
          </div>

          <article className="clay relative z-10 rounded-[2.25rem] bg-card p-5">
            <div className="relative grid h-[150px] place-items-center overflow-hidden rounded-3xl bg-sky-t">
              <span className="absolute left-3 top-3 rounded-full bg-lime px-2.5 py-1 text-xs font-extrabold">FREE · priority</span>
              <span className="absolute right-3 top-3 rounded-full bg-lavender-t px-2.5 py-1 text-xs font-extrabold text-violet">94% match</span>
              <svg viewBox="0 0 200 120" className="w-[64%]" aria-hidden="true">
                <rect x="40" y="10" width="120" height="80" rx="12" fill="#5B6B8C" />
                <rect x="48" y="18" width="104" height="64" rx="7" fill="#9BE0F5" />
                <circle cx="80" cy="45" r="9" fill="#fff" opacity=".7" />
                <path d="M58 76 L84 52 L102 68 L118 56 L142 76Z" fill="#7BC043" />
                <path d="M20 92 H180 C180 104 170 110 160 110 H40 C30 110 20 104 20 92Z" fill="#C9CFDC" />
                <rect x="86" y="94" width="28" height="5" rx="2.5" fill="#A9B0C0" />
              </svg>
            </div>
            <h3 className="mt-3.5 text-[1.35rem] font-bold">Laptop · Dell Inspiron (2019)</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-extrabold">
              <span className="rounded-full bg-sky-t px-2.5 py-1">📍 1.2 km · Koramangala</span>
              <span className="rounded-full bg-butter-t px-2.5 py-1">✓ Working · Good</span>
            </div>
            <div className="mt-3.5 rounded-2xl bg-cream px-3 py-2.5">
              <div className="flex justify-between text-sm font-bold">
                <span>Free for students &amp; NGOs</span>
                <span>2 days left</span>
              </div>
              <div className="clay-inset mt-1.5 h-3 overflow-hidden rounded-full bg-cream-2">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-lime to-[#9ADB3C]" />
              </div>
              <small className="text-plum-soft">Then listed at ₹6,500 in the marketplace</small>
            </div>
            <Button variant="coral" className="mt-3.5 w-full" onClick={(e) => burstConfetti(e.currentTarget)}>
              Request for free
            </Button>
          </article>
        </motion.div>
      </div>
    </section>
  );
}
