"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, PackagePlus } from "lucide-react";
import { AnalyticsTabs, DemoDataNote } from "@/components/charts/AnalyticsTabs";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { kg } from "@/components/charts/theme";
import { PageShell } from "@/components/layout/PageShell";
import { ErrorNote, LoadingState } from "@/components/ui/EmptyState";
import type { Backtest, CategoryForecast, ForecastReport } from "@/lib/analyticsTypes";
import { useApi } from "@/lib/hooks";

const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);

function AccuracyRow({ label, b }: { label: string; b: Backtest }) {
  const wins = b.model_wape != null && b.naive_wape != null && b.model_wape < b.naive_wape;
  return (
    <li className="rounded-2xl bg-cream px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <b>{label}</b>
        {/* status = icon + label, never colour alone */}
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${wins ? "bg-lime-t" : "bg-butter-t"}`}>
          {wins ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
          {wins ? "Beats the baseline" : "Baseline was better"}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-plum-soft">
        Error over the last {b.weeks} weeks: <b className="text-plum">{pct(b.model_wape)}</b> for our model ({b.model.toLowerCase()})
        vs <b className="text-plum">{pct(b.naive_wape)}</b> for “same week last year”.
      </p>
    </li>
  );
}

function Detail({ c }: { c: CategoryForecast }) {
  const gap = c.totals.demand - c.totals.supply;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr]">
      <ForecastChart data={c} />
      <aside className="grid h-fit gap-4">
        <section className="clay-sm rounded-[1.75rem] bg-card p-5" aria-label="Next weeks">
          <h3 className="text-lg font-bold">Next {c.forecast.length} weeks</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-sky-t px-3 py-2"><dt className="text-xs font-bold text-plum-soft">Expected to be given</dt><dd className="text-xl font-extrabold">{kg(c.totals.supply)}</dd></div>
            <div className="rounded-2xl bg-coral-t px-3 py-2"><dt className="text-xs font-bold text-plum-soft">Expected to be requested</dt><dd className="text-xl font-extrabold">{kg(c.totals.demand)}</dd></div>
          </dl>
          <p className="mt-2 text-sm font-semibold text-plum-soft">
            {gap > 0 ? `About ${kg(gap)} more requested than given.` : `About ${kg(-gap)} more given than requested.`}
          </p>
          {c.alert && (
            <p className={`mt-2 flex gap-2 rounded-2xl px-3 py-2 text-sm font-bold ${c.alert.kind === "shortage" ? "bg-coral-t" : "bg-lavender-t"}`} role="status">
              {c.alert.kind === "shortage" ? <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true" /> : <PackagePlus size={16} className="mt-0.5 flex-none" aria-hidden="true" />}
              <span><span className="sr-only">{c.alert.kind === "shortage" ? "Shortage: " : "Surplus: "}</span>{c.alert.message}</span>
            </p>
          )}
        </section>
        <section className="clay-sm rounded-[1.75rem] bg-card p-5" aria-label="How accurate is this">
          <h3 className="text-lg font-bold">How accurate is this?</h3>
          <p className="text-xs font-semibold text-plum-soft">
            We hid the last 8 weeks, chose a model using only the weeks before them, then checked its forecast against what really happened.
          </p>
          <ul className="mt-2 grid gap-2">
            <AccuracyRow label="Given" b={c.backtest.supply} />
            <AccuracyRow label="Requested" b={c.backtest.demand} />
          </ul>
        </section>
      </aside>
    </div>
  );
}

export default function InsightsPage() {
  const { data, error, loading } = useApi<ForecastReport>("/api/insights/forecast?horizon=8");
  const [selected, setSelected] = useState<string | null>(null);
  const active = data?.categories.find((c) => c.category === (selected ?? data.alerts[0]?.category ?? data.categories[0]?.category));

  const series = data ? data.categories.flatMap((c) => [c.backtest.supply, c.backtest.demand]) : [];
  const wins = series.filter((b) => b.model_wape != null && b.naive_wape != null && b.model_wape < b.naive_wape).length;

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-violet">Supply &amp; demand · {data?.city ?? "Bengaluru"}</p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold">See shortages before they happen</h1>
          <p className="max-w-2xl text-plum-soft">
            Weekly forecasts of what will be given and what will be asked for, so NGOs can plan and donors know when their help counts most.
          </p>
        </div>
        <AnalyticsTabs active="insights" />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : loading || !data ? <LoadingState label="Reading the trends…" /> : (
        <>
          {data.alerts.length > 0 && (
            <ul className="mb-5 grid gap-3 md:grid-cols-2" aria-label="Alerts">
              {data.alerts.map((a) => (
                <li key={a.category}>
                  <button onClick={() => setSelected(a.category)}
                    className={`clay-sm flex w-full gap-3 rounded-[1.5rem] p-4 text-left ${a.kind === "shortage" ? "bg-coral-t" : "bg-lavender-t"}`}>
                    <span className="text-3xl" aria-hidden="true">{a.icon}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider">
                        {a.kind === "shortage" ? <AlertTriangle size={14} aria-hidden="true" /> : <PackagePlus size={14} aria-hidden="true" />}
                        {a.kind === "shortage" ? "Shortage expected" : "Surplus expected"}
                      </span>
                      <span className="mt-0.5 block font-semibold">{a.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Category">
              {data.categories.map((c) => (
                <button key={c.category} role="tab" aria-selected={active?.category === c.category} onClick={() => setSelected(c.category)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold ${active?.category === c.category ? "clay-sm bg-plum text-white" : "bg-card hover:bg-cream-2"}`}>
                  {c.icon} {c.name}
                  {c.alert && <span className={`h-2 w-2 rounded-full ${c.alert.kind === "shortage" ? "bg-coral" : "bg-lavender"}`} aria-label={c.alert.kind} />}
                </button>
              ))}
            </div>
            <p className="text-sm font-bold text-plum-soft">Model beats “same week last year” in <b className="text-plum">{wins} of {series.length}</b> series</p>
          </div>

          {active && <Detail c={active} />}
          <DemoDataNote />
        </>
      )}
    </PageShell>
  );
}
