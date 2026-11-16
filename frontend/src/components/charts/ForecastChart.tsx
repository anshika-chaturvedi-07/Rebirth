"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryForecast } from "@/lib/analyticsTypes";
import { ChartCard, DataTable, TooltipBox } from "./ChartCard";
import { CHART, axisTick, kg, num } from "./theme";

const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

interface Row {
  week: string;
  label: string;
  supply?: number;
  demand?: number;
  supplyF?: number;
  demandF?: number;
  supplyBand?: [number, number];
  demandBand?: [number, number];
}

/**
 * Two series (supply, demand) on ONE axis, same unit (kg/week). Actuals are solid, the forecast is dashed
 * (dashes mean "projection" here), with the 80% interval as a 10% wash. A "Today" rule marks the hand-off.
 */
export function ForecastChart({ data }: { data: CategoryForecast }) {
  const hist: Row[] = data.history.map((h) => ({ week: h.week, label: short(h.week), supply: h.supply, demand: h.demand }));
  const last = hist[hist.length - 1];
  // the forecast lines start at the last actual week so the two halves join
  if (last) {
    last.supplyF = last.supply;
    last.demandF = last.demand;
  }
  const fut: Row[] = data.forecast.map((f) => ({
    week: f.week, label: short(f.week), supplyF: f.supply, demandF: f.demand,
    supplyBand: [f.supply_low, f.supply_high], demandBand: [f.demand_low, f.demand_high],
  }));
  const rows = [...hist, ...fut];
  const today = fut[0]?.label;

  return (
    <ChartCard
      title={`${data.icon} ${data.name}: kilograms per week`}
      subtitle={`Last ${data.history.length} weeks, then an ${data.forecast.length}-week forecast with an 80% range`}
      legend={[
        { label: "Given (supply)", color: CHART.supply },
        { label: "Requested (demand)", color: CHART.demand },
        { label: "Forecast", color: CHART.axis, dashed: true },
      ]}
      table={
        <DataTable
          head={["Week of", "Given (kg)", "Requested (kg)", "Kind"]}
          rows={[
            ...data.history.map((h) => [short(h.week), num(h.supply), num(h.demand), "Actual"]),
            ...data.forecast.map((f) => [short(f.week), `${num(f.supply)} (${num(f.supply_low)}–${num(f.supply_high)})`,
              `${num(f.demand)} (${num(f.demand_low)}–${num(f.demand_high)})`, "Forecast"]),
          ]}
        />
      }
    >
      <div className="h-72" role="img" aria-label={`Supply and demand for ${data.name}. Table view available.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={3} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => num(v)} />
            <Area dataKey="supplyBand" stroke="none" fill={CHART.supply} fillOpacity={0.1} isAnimationActive={false} />
            <Area dataKey="demandBand" stroke="none" fill={CHART.demand} fillOpacity={0.1} isAnimationActive={false} />
            {today && <ReferenceLine x={today} stroke={CHART.axis} strokeWidth={1} label={{ value: "Today", position: "insideTopRight", fill: CHART.axis, fontSize: 12, fontWeight: 700 }} />}
            <Line dataKey="supply" stroke={CHART.supply} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }} strokeLinecap="round" connectNulls={false} isAnimationActive={false} />
            <Line dataKey="demand" stroke={CHART.demand} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }} strokeLinecap="round" connectNulls={false} isAnimationActive={false} />
            <Line dataKey="supplyF" stroke={CHART.supply} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <Line dataKey="demandF" stroke={CHART.demand} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as Row;
                const isF = r.supply === undefined;
                return <TooltipBox title={`Week of ${r.label}${isF ? " · forecast" : ""}`} rows={[
                  { label: "Given", value: kg((isF ? r.supplyF : r.supply) ?? 0), color: CHART.supply, dashed: isF },
                  ...(isF && r.supplyBand ? [{ label: "  range", value: `${num(r.supplyBand[0])}–${num(r.supplyBand[1])}` }] : []),
                  { label: "Requested", value: kg((isF ? r.demandF : r.demand) ?? 0), color: CHART.demand, dashed: isF },
                  ...(isF && r.demandBand ? [{ label: "  range", value: `${num(r.demandBand[0])}–${num(r.demandBand[1])}` }] : []),
                ]} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
