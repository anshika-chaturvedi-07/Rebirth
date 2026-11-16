"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ListingCard } from "@/components/listings/ListingCard";
import { SectionHead } from "@/components/landing/SectionHead";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote, LoadingState } from "@/components/ui/EmptyState";
import { CATEGORY_TILES } from "@/lib/categories";
import { useApi } from "@/lib/hooks";
import type { Listing, Stage } from "@/lib/types";

const STAGES: { id: Stage | "all"; label: string; tint: string }[] = [
  { id: "all", label: "Everything", tint: "bg-card" },
  { id: "free", label: "🎁 Free first", tint: "bg-lime" },
  { id: "marketplace", label: "🏷️ Marketplace", tint: "bg-sky" },
  { id: "recycle", label: "♻️ Repair & recycle", tint: "bg-lavender" },
];

export default function BrowsePage() {
  return (
    <Suspense>
      <Browse />
    </Suspense>
  );
}

function Browse() {
  const initialCategory = useSearchParams().get("category");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [category, setCategory] = useState<string | null>(
    CATEGORY_TILES.some((c) => c.slug === initialCategory) ? initialCategory : null,
  );
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const path = useMemo(() => {
    const p = new URLSearchParams({ limit: "48" });
    if (stage !== "all") p.set("stage", stage);
    if (category) p.set("category", category);
    if (query) p.set("q", query);
    return `/api/listings?${p}`;
  }, [stage, category, query]);

  const { data, error, loading } = useApi<{ items: Listing[]; total: number }>(path);

  return (
    <PageShell>
      <SectionHead kicker="Explore" title="What's looking for a second home?">
        Free items go to NGOs, schools and people in need first. Then anyone can buy them cheaply, and finally repairers and recyclers.
      </SectionHead>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Lifecycle stage" className="clay-sm flex flex-wrap gap-1 rounded-full bg-card p-1.5">
          {STAGES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={stage === s.id}
              onClick={() => setStage(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${stage === s.id ? `${s.tint} clay-sm` : "hover:bg-cream"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="clay-inset flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-4 py-2.5 sm:max-w-xs">
          <Search size={18} className="text-plum-soft" aria-hidden="true" />
          <span className="sr-only">Search items</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search laptops, chairs…" className="min-w-0 flex-1 bg-transparent font-semibold focus:outline-none" />
        </label>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Categories">
        <button onClick={() => setCategory(null)} className={`flex-none rounded-full px-3.5 py-1.5 text-sm font-bold ${category === null ? "clay-sm bg-plum text-white" : "bg-card"}`}>
          All categories
        </button>
        {CATEGORY_TILES.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCategory(category === c.slug ? null : c.slug)}
            aria-pressed={category === c.slug}
            className={`flex-none rounded-full px-3.5 py-1.5 text-sm font-bold ${category === c.slug ? `clay-sm ${c.tint} outline-2 outline-plum/30` : "bg-card hover:bg-cream-2"}`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : loading && !data ? (
          <LoadingState label="Sniffing out items…" />
        ) : !data?.items.length ? (
          <EmptyState title="Nothing here right now" action={<ButtonLink href="/listings/new" variant="coral" size="sm">Give something</ButtonLink>}>
            Try another category or stage, or be the first to list something.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-plum-soft">{data.total} item{data.total === 1 ? "" : "s"}</p>
            <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
              {data.items.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
