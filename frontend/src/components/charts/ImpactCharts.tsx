"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CityImpact, ImpactBreakdown } from "@/lib/analyticsTypes";
import { ChartCard, DataTable, TooltipBox } from "./ChartCard";
import { CHART, axisTick, kg, num } from "./theme";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleString("en-IN", { month: "short" });
const monthLong = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });

/** Columns: one series (kg reused per month), so no legend; the title names it. */
export function MonthlyImpact({ data, title = "Kilograms given a second life, by month" }: { data: ImpactBreakdown["by_month"]; title?: string }) {
  const rows = data.map((m) => ({ ...m, label: monthLabel(m.month) }));
  return (
    <ChartCard
      title={title}
      subtitle="Last 12 months · hover a month for CO₂e and meals"
      table={<DataTable head={["Month", "Kg", "CO₂e (kg)", "Handovers"]} rows={data.map((m) => [monthLong(m.month), num(m.kg), num(m.co2e_kg), m.handovers])} />}
    >
      <div className="h-64" role="img" aria-label={`${title}. Table view available.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: CHART.grid }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => num(v)} />
            <Tooltip
              cursor={{ fill: CHART.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const m = payload[0].payload as (typeof rows)[number];
                return <TooltipBox title={monthLong(m.month)} rows={[
                  { label: "Reused", value: kg(m.kg), color: CHART.impact },
                  { label: "CO₂e avoided", value: kg(m.co2e_kg) },
                  { label: "Handovers", value: num(m.handovers) },
                  ...(m.meals ? [{ label: "Meals", value: num(m.meals) }] : []),
                ]} />;
              }}
            />
            <Bar dataKey="kg" fill={CHART.impact} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Ranked horizontal bars, one colour (nominal categories never get a value ramp); value at the tip. */
export function CategoryImpact({ data }: { data: ImpactBreakdown["by_category"] }) {
  const rows = data.slice(0, 8).map((c) => ({ ...c, label: `${c.icon} ${c.name}` }));
  return (
    <ChartCard
      title="CO₂e avoided by category"
      subtitle="Ranked · reusing electronics and clothes saves the most per kilogram"
      table={<DataTable head={["Category", "CO₂e (kg)", "Kg reused", "Handovers"]} rows={data.map((c) => [c.name, num(c.co2e_kg), num(c.kg), c.handovers])} />}
    >
      <div style={{ height: rows.length * 40 + 10 }} role="img" aria-label="CO2e avoided by category. Table view available.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap="30%">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={170} />
            <Tooltip
              cursor={{ fill: CHART.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const c = payload[0].payload as (typeof rows)[number];
                return <TooltipBox title={c.name} rows={[
                  { label: "CO₂e avoided", value: kg(c.co2e_kg), color: CHART.single },
                  { label: "Reused", value: kg(c.kg) },
                  { label: "Handovers", value: num(c.handovers) },
                ]} />;
              }}
            />
            <Bar dataKey="co2e_kg" fill={CHART.single} maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="co2e_kg" position="right" formatter={(v) => kg(Number(v))} style={{ fill: CHART.ink, fontSize: 12, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const STAGE_LABEL = { free: "Free to people in need", marketplace: "Low-price marketplace", recycle: "Repaired or recycled" } as const;

/** Tall segmented bar: one whole (all handovers) split by the stage where the item found its home. */
export function StageSplit({ stages }: { stages: CityImpact["stages"] }) {
  const total = stages.reduce((s, x) => s + x.handovers, 0) || 1;
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden" role="img"
        aria-label={stages.map((s) => `${STAGE_LABEL[s.stage]} ${Math.round(s.share * 100)}%`).join(", ")}>
        {stages.filter((s) => s.handovers > 0).map((s) => {
          const pct = (s.handovers / total) * 100;
          return (
            <div key={s.stage} className="flex h-full items-center rounded-[4px] px-2 text-xs font-extrabold text-white"
              style={{ width: `${pct}%`, background: CHART.stage[s.stage] }}
              title={`${STAGE_LABEL[s.stage]}: ${num(s.handovers)} handovers (${Math.round(pct)}%)`} tabIndex={0}>
              {pct >= 9 ? `${Math.round(pct)}%` : ""}
            </div>
          );
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-plum-soft" aria-label="Legend">
        {stages.map((s) => (
          <li key={s.stage} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: CHART.stage[s.stage] }} aria-hidden="true" />
            {STAGE_LABEL[s.stage]} <span className="text-plum/70">· {num(s.handovers)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
