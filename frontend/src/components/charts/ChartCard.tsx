"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";

/** Card with a title, an optional legend, and a chart / table switch (every chart has a table twin). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: { label: string; color: string; dashed?: boolean }[];
  table: ReactNode;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="clay-sm min-w-0 rounded-[1.75rem] bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold">{title}</h3>
          {subtitle && <p className="text-sm font-semibold text-plum-soft">{subtitle}</p>}
        </div>
        <div className="flex rounded-full bg-cream p-1" role="group" aria-label="Show as">
          <button onClick={() => setView("chart")} aria-pressed={view === "chart"} title="Chart"
            className={`grid h-8 w-8 place-items-center rounded-full ${view === "chart" ? "clay-sm bg-card" : ""}`}>
            <BarChart3 size={16} aria-hidden="true" /><span className="sr-only">Chart</span>
          </button>
          <button onClick={() => setView("table")} aria-pressed={view === "table"} title="Table"
            className={`grid h-8 w-8 place-items-center rounded-full ${view === "table" ? "clay-sm bg-card" : ""}`}>
            <Table2 size={16} aria-hidden="true" /><span className="sr-only">Table</span>
          </button>
        </div>
      </div>
      {legend && view === "chart" && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-plum-soft" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="17" y2="4" stroke={l.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={l.dashed ? "4 3" : undefined} />
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">{view === "chart" ? children : <div className="max-h-80 overflow-auto">{table}</div>}</div>
    </section>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-card">
        <tr>{head.map((h, i) => <th key={h} className={`py-2 pr-3 font-extrabold ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-cream-2">
            {r.map((c, j) => <td key={j} className={`py-1.5 pr-3 font-semibold ${j > 0 ? "text-right" : ""}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Rounded tooltip in the clay style, shared by all charts. */
export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="clay rounded-2xl bg-card px-3.5 py-2.5 text-sm">
      <p className="mb-1 font-extrabold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 font-semibold text-plum-soft">
          {r.color && (
            <svg width="14" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="13" y2="4" stroke={r.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={r.dashed ? "3 3" : undefined} />
            </svg>
          )}
          <span className="flex-1">{r.label}</span>
          <b className="tabular-nums text-plum">{r.value}</b>
        </p>
      ))}
    </div>
  );
}
