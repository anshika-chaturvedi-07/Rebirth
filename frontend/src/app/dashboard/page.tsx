"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Character } from "@/components/characters/Character";
import type { CharacterId } from "@/components/characters/cast";
import { PageShell } from "@/components/layout/PageShell";
import { StageChip, tileFor } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote, LoadingState } from "@/components/ui/EmptyState";
import { burstConfetti } from "@/lib/confetti";
import { formatQty, ROLE_LABEL, timeAgo, URGENCY } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Listing, MyClaim, Need, Role, Suggestions as SuggestionsData, User } from "@/lib/types";
import type { MyImpact } from "@/lib/analyticsTypes";
import { MatchScore, ReasonChips } from "@/components/matching/MatchScore";

const ROLE_CHARACTER: Record<Role, CharacterId> = {
  donor: "meera", business: "dadi", organisation: "fatima", individual: "aarav",
  volunteer: "ravi", recycler: "kabir", admin: "fatima",
};
const CAN_LIST: Role[] = ["donor", "business", "organisation", "individual", "recycler", "admin"];
const CAN_POST_NEEDS: Role[] = ["organisation", "individual", "admin"];

const CLAIM_CHIP: Record<string, string> = {
  pending: "bg-butter", accepted: "bg-lime", declined: "bg-cream-2", completed: "bg-sky", cancelled: "bg-cream-2",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MyImpactStrip() {
  const { data } = useApi<MyImpact>("/api/impact/me");
  if (!data) return null;
  const t = [data.given.total, data.received.total, data.delivered.total];
  const kgSum = t.reduce((s, x) => s + x.kg, 0);
  const co2 = t.reduce((s, x) => s + x.co2e_kg, 0);
  const n = t.reduce((s, x) => s + x.handovers, 0);
  if (!n) return null;
  return (
    <Link href="/impact" className="clay mt-8 flex flex-wrap items-center gap-4 rounded-[2rem] bg-lime-t p-5 hover:-translate-y-0.5 transition-transform">
      <span className="text-4xl" aria-hidden="true">🌱</span>
      <span className="min-w-0 flex-1">
        <b className="block text-xl">Your impact so far</b>
        <span className="font-semibold text-plum-soft">
          {kgSum >= 1000 ? `${(kgSum / 1000).toFixed(1)} t` : `${Math.round(kgSum)} kg`} given a second life · {Math.round(co2).toLocaleString("en-IN")} kg CO₂e avoided · {n} handover{n === 1 ? "" : "s"}
        </span>
      </span>
      <span className="font-bold text-violet">See the city&apos;s impact →</span>
    </Link>
  );
}

function Suggestions({ user }: { user: User }) {
  const { data, loading } = useApi<SuggestionsData>("/api/me/suggestions");
  if (loading || !data) return null;
  const items = data.for_my_needs;
  const needs = data.for_my_items;
  if (!items.length && !needs.length) return null;
  return (
    <Section title="✨ Suggested for you">
      <p className="-mt-2 mb-3 text-sm font-semibold text-plum-soft">
        Matched on distance, how well it fits, urgency, quantity and whether it&apos;s free. Hover a score to see the breakdown.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((m) => (
          <li key={`l-${m.listing.id}`} className="clay-sm rounded-3xl bg-card p-4">
            <div className="flex items-start gap-3">
              <span className={`grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-2xl text-2xl ${tileFor(m.listing.category).tint}`} aria-hidden="true">
                {m.listing.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user uploads served by the API
                  <img src={m.listing.photos[0]} alt="" className="h-full w-full object-cover" />
                ) : tileFor(m.listing.category).icon}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/listings/${m.listing.id}`} className="block truncate font-bold hover:underline">{m.listing.title}</Link>
                <small className="font-bold text-plum-soft">by {m.listing.donor.name}</small>
              </div>
              <MatchScore score={m.score} components={m.components} />
            </div>
            <div className="mt-2.5"><ReasonChips reasons={m.reasons} /></div>
          </li>
        ))}
        {needs.map((m) => (
          <li key={`n-${m.need.id}-${m.listing_id}`} className="clay-sm rounded-3xl bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-coral-t text-2xl" aria-hidden="true">🙋</span>
              <div className="min-w-0 flex-1">
                <b className="block truncate">{m.need.title}</b>
                <small className="font-bold text-plum-soft">
                  {m.need.requester.name} could use your{" "}
                  <Link href={`/listings/${m.listing_id}`} className="text-violet hover:underline">{m.listing_title}</Link>
                </small>
              </div>
              <MatchScore score={m.score} components={m.components} />
            </div>
            <div className="mt-2.5"><ReasonChips reasons={m.reasons} /></div>
          </li>
        ))}
      </ul>
      {user.role !== "organisation" && user.role !== "individual" && needs.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-plum-soft">They&apos;ll see your item in their suggestions and can request it.</p>
      )}
    </Section>
  );
}

function MyListings() {
  const { data, error, loading } = useApi<{ items: Listing[] }>("/api/listings?mine=true&limit=50");
  if (loading) return <LoadingState />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.items.length)
    return <EmptyState title="Nothing listed yet" action={<ButtonLink href="/listings/new" variant="coral" size="sm">Give your first item</ButtonLink>}>Snap something you don&apos;t need and REBIRTH will find it a new home.</EmptyState>;
  return (
    <ul className="grid gap-3">
      {data.items.map((l) => (
        <li key={l.id}>
          <Link href={`/listings/${l.id}`} className="clay-sm flex items-center gap-3 rounded-3xl bg-card p-3 hover:bg-cream">
            <span className={`grid h-12 w-12 flex-none place-items-center rounded-2xl text-2xl ${tileFor(l.category).tint}`} aria-hidden="true">{tileFor(l.category).icon}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{l.title}</b>
              <small className="font-bold text-plum-soft">{formatQty(l.quantity, l.unit)} · listed {timeAgo(l.created_at)}</small>
            </span>
            {l.status === "active" ? <StageChip stage={l.stage} /> : <span className="rounded-full bg-sky-t px-2.5 py-1 text-xs font-extrabold capitalize">{l.status}</span>}
            {l.claim_count > 0 && l.status === "active" && (
              <span className="rounded-full bg-coral px-2.5 py-1 text-xs font-extrabold text-white">{l.claim_count} request{l.claim_count > 1 ? "s" : ""}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MyClaims() {
  const { data, error, loading } = useApi<MyClaim[]>("/api/me/claims");
  if (loading) return <LoadingState />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.length)
    return <EmptyState title="No requests yet" action={<ButtonLink href="/listings" size="sm">Explore items</ButtonLink>}>When you request an item, you can follow it here.</EmptyState>;
  return (
    <ul className="grid gap-3">
      {data.map((c) => (
        <li key={c.id}>
          <Link href={`/listings/${c.listing_id}`} className="clay-sm flex items-center gap-3 rounded-3xl bg-card p-3 hover:bg-cream">
            <span className={`grid h-12 w-12 flex-none place-items-center rounded-2xl text-2xl ${tileFor(c.listing_category).tint}`} aria-hidden="true">{tileFor(c.listing_category).icon}</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{c.listing_title}</b>
              <small className="font-bold text-plum-soft">Requested {timeAgo(c.created_at)}</small>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold capitalize ${CLAIM_CHIP[c.status]}`}>{c.status}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MyNeeds() {
  const { data, error, loading } = useApi<Need[]>("/api/needs?mine=true");
  if (loading) return <LoadingState />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.length)
    return <EmptyState title="No needs posted" action={<ButtonLink href="/needs/new" variant="lavender" size="sm">Post a need</ButtonLink>}>Tell donors what you&apos;re looking for. Urgent needs are shown first.</EmptyState>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.map((n) => (
        <li key={n.id} className="clay-sm rounded-3xl bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <b>{n.title}</b>
            <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-extrabold ${n.status === "open" ? URGENCY[n.urgency].chip : "bg-sky-t"}`}>
              {n.status === "open" ? URGENCY[n.urgency].label : n.status}
            </span>
          </div>
          <small className="font-bold text-plum-soft">{formatQty(n.quantity, n.unit)} · posted {timeAgo(n.created_at)}</small>
        </li>
      ))}
    </ul>
  );
}

function Dashboard({ user }: { user: User }) {
  const welcome = useSearchParams().get("welcome") === "1";
  const hello = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (welcome && hello.current) burstConfetti(hello.current, 50);
  }, [welcome]);

  const first = user.name.split(/[\s·]/)[0];
  const canList = CAN_LIST.includes(user.role);
  const canPostNeeds = CAN_POST_NEEDS.includes(user.role);

  return (
    <>
      <div className="clay relative mt-2 flex flex-wrap items-center gap-5 overflow-hidden rounded-[2.25rem] bg-card px-6 py-5">
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-lavender-t px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-violet">
            {ROLE_LABEL[user.role]}{user.verified ? " · ✓ Verified" : ""} · {user.city}
          </span>
          <h1 ref={hello} className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold">
            {welcome ? `Welcome to REBIRTH, ${first}! 🎉` : `${greeting()}, ${first}!`}
          </h1>
          <p className="text-plum-soft">
            {welcome ? "Your account is ready. Here's where everything you give and receive will live." : "Here's what's happening with your items and requests."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {canList && <ButtonLink href="/listings/new" variant="coral" size="sm">📸 Give something</ButtonLink>}
            {canPostNeeds && <ButtonLink href="/needs/new" variant="lavender" size="sm">🙋 Post a need</ButtonLink>}
            <ButtonLink href="/listings" size="sm">🔎 Explore items</ButtonLink>
          </div>
        </div>
        <Character id={ROLE_CHARACTER[user.role]} wave className="-mb-8 w-36 flex-none self-end sm:w-44" />
      </div>

      {user.role === "volunteer" && (
        <div className="clay mt-8 flex flex-wrap items-center gap-4 rounded-[2rem] bg-butter-t p-5">
          <span className="text-4xl" aria-hidden="true">🗺️</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">Deliveries near you</h2>
            <p className="text-plum-soft">See items waiting for a ride and get one optimised route for several pickups and drop-offs.</p>
          </div>
          <ButtonLink href="/volunteer" variant="coral" size="sm">🚚 Plan my route</ButtonLink>
        </div>
      )}

      {user.role === "organisation" && !user.verified && (
        <Link href="/verify" className="clay mt-8 flex flex-wrap items-center gap-4 rounded-[2rem] bg-lavender-t p-5 transition-transform hover:-translate-y-0.5">
          <span className="text-4xl" aria-hidden="true">🛡️</span>
          <span className="min-w-0 flex-1">
            <b className="block text-xl">Get your organisation verified</b>
            <span className="font-semibold text-plum-soft">Add your NGO Darpan ID or school UDISE code. Verified organisations get a badge and rank higher in matches.</span>
          </span>
          <span className="font-bold text-violet">Start →</span>
        </Link>
      )}

      <Suggestions user={user} />
      <MyImpactStrip />
      {user.role !== "volunteer" && user.role !== "admin" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={`/api/impact/me/report.pdf?scope=${user.role === "organisation" || user.role === "individual" ? "received" : "given"}`}
            className="clay-sm inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold hover:bg-cream">
            📄 Download impact report (PDF)
          </a>
          <Link href="/leaderboard" className="text-sm font-bold text-violet hover:underline">🏆 See your badges</Link>
          <span className="text-xs font-semibold text-plum-soft">Handy for CSR reporting or an NGO&apos;s annual report</span>
        </div>
      )}

      {canList && (
        <Section title="My listings" action={<Link href="/listings/new" className="font-bold text-violet hover:underline">+ New listing</Link>}>
          <MyListings />
        </Section>
      )}
      {canPostNeeds && (
        <Section title="My needs" action={<Link href="/needs/new" className="font-bold text-violet hover:underline">+ Post a need</Link>}>
          <MyNeeds />
        </Section>
      )}
      <Section title="My requests">
        <MyClaims />
      </Section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <PageShell>
      <RequireAuth>
        {(user) => (
          <Suspense>
            <Dashboard user={user} />
          </Suspense>
        )}
      </RequireAuth>
    </PageShell>
  );
}
