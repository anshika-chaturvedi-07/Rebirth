const LABELS: Record<string, string> = {
  distance: "Distance",
  relevance: "Fits the need",
  urgency: "Urgency",
  coverage: "Quantity",
  cost: "Free",
  time: "Time pressure",
  trust: "Trust",
};

function tone(score: number) {
  if (score >= 0.7) return { bar: "bg-lime", text: "Great match" };
  if (score >= 0.5) return { bar: "bg-sky", text: "Good match" };
  return { bar: "bg-butter", text: "Possible match" };
}

/** Score pill + bar. Hovering or focusing shows the per-factor breakdown. */
export function MatchScore({ score, components }: { score: number; components?: Record<string, number> }) {
  const t = tone(score);
  const pct = Math.round(score * 100);
  return (
    <div className="group relative w-full max-w-44" tabIndex={0} aria-label={`${t.text}, ${pct}%`}>
      <div className="flex items-baseline justify-between text-xs font-extrabold">
        <span>{t.text}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="clay-inset mt-1 h-2.5 overflow-hidden rounded-full bg-cream-2">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
      </div>
      {components && (
        <div role="tooltip" className="clay pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-52 rounded-2xl bg-card p-3 text-xs group-hover:block group-focus:block">
          <p className="mb-1.5 font-extrabold">Why this score</p>
          {Object.entries(components).map(([k, v]) => (
            <div key={k} className="mb-1 grid grid-cols-[1fr_70px] items-center gap-2 font-bold">
              <span className="text-plum-soft">{LABELS[k] ?? k}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-cream-2">
                <span className="block h-full rounded-full bg-lavender" style={{ width: `${Math.round(v * 100)}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReasonChips({ reasons, max = 4 }: { reasons: string[]; max?: number }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Why it was suggested">
      {reasons.slice(0, max).map((r) => (
        <li key={r} className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-bold text-plum-soft">{r}</li>
      ))}
    </ul>
  );
}
