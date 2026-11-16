"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Character } from "@/components/characters/Character";
import { SectionHead } from "@/components/landing/SectionHead";
import { PageShell } from "@/components/layout/PageShell";
import { tileFor } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote, LoadingState } from "@/components/ui/EmptyState";
import { CATEGORY_TILES } from "@/lib/categories";
import { formatQty, ROLE_LABEL, timeAgo, URGENCY } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Need } from "@/lib/types";

export default function NeedsBoardPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<string | null>(null);
  const { data, error, loading } = useApi<Need[]>(`/api/needs${category ? `?category=${category}` : ""}`);
  const canPost = user && (user.role === "organisation" || user.role === "individual" || user.role === "admin");

  return (
    <PageShell>
      <div className="clay mb-8 flex flex-wrap items-center gap-5 overflow-hidden rounded-[2.25rem] bg-lavender-t px-6 py-5">
        <div className="min-w-0 flex-1">
          <SectionHead kicker="Needs board" title="Who needs what, right now">
            Schools, shelters, kitchens and people post what they&apos;re missing. Urgent needs are shown first. Have something that fits? List it.
          </SectionHead>
          <div className="-mt-3 flex flex-wrap gap-2.5">
            {canPost && <ButtonLink href="/needs/new" variant="lavender" size="sm">🙋 Post a need</ButtonLink>}
            <ButtonLink href="/listings/new" variant="coral" size="sm">🎁 Give something</ButtonLink>
          </div>
        </div>
        <Character id="fatima" wave className="-mb-8 hidden w-40 flex-none self-end sm:block" />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-2" aria-label="Categories">
        <button onClick={() => setCategory(null)} className={`flex-none rounded-full px-3.5 py-1.5 text-sm font-bold ${category === null ? "clay-sm bg-plum text-white" : "bg-card"}`}>All</button>
        {CATEGORY_TILES.map((c) => (
          <button key={c.slug} onClick={() => setCategory(category === c.slug ? null : c.slug)} aria-pressed={category === c.slug}
            className={`flex-none rounded-full px-3.5 py-1.5 text-sm font-bold ${category === c.slug ? `clay-sm ${c.tint} outline-2 outline-plum/30` : "bg-card hover:bg-cream-2"}`}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : loading && !data ? <LoadingState /> : !data?.length ? (
        <EmptyState title="No open needs here">Everyone in this category is sorted for now. Check another category.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((n) => {
            const tile = tileFor(n.category);
            return (
              <li key={n.id} className="clay flex gap-4 rounded-[2rem] bg-card p-5">
                <span className={`grid h-14 w-14 flex-none place-items-center rounded-2xl text-3xl ${tile.tint}`} aria-hidden="true">{tile.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-xl font-bold">{n.title}</h3>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-extrabold ${URGENCY[n.urgency].chip}`}>{URGENCY[n.urgency].label}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm font-bold text-plum-soft">
                    {n.requester.name}
                    {n.requester.verified && <BadgeCheck size={15} className="text-violet" aria-label="Verified" />}
                    · {ROLE_LABEL[n.requester.role]}
                  </p>
                  {n.description && <p className="mt-2">{n.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-extrabold">
                    <span className="rounded-full bg-sky-t px-2.5 py-1">Needs {formatQty(n.quantity, n.unit)}</span>
                    <span className="rounded-full bg-mint-t px-2.5 py-1">📍 {[n.area, n.city].filter(Boolean).join(", ")}</span>
                    <span className="rounded-full bg-cream px-2.5 py-1">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
