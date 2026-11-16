"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ClayMap } from "@/components/map/ClayMap";
import { listingMarker } from "@/components/map/pins";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageShell } from "@/components/layout/PageShell";
import { StageChip, tileFor } from "@/components/listings/ListingCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote, LoadingState } from "@/components/ui/EmptyState";
import { Select, Textarea } from "@/components/ui/FormBits";
import { MatchScore, ReasonChips } from "@/components/matching/MatchScore";
import { PayButton } from "@/components/trust/Checkout";
import { ReportButton, ReviewBox, Stars } from "@/components/trust/Community";
import { api } from "@/lib/api";
import { burstConfetti } from "@/lib/confetti";
import { CONDITION_LABEL, formatINR, formatQty, ROLE_LABEL, timeAgo, timeLeft } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Claim, DeliveryStatus, Listing, Need, NeedMatch, Stage } from "@/lib/types";

const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  open: "waiting for a volunteer",
  assigned: "volunteer on the way",
  picked_up: "picked up, on its way",
  delivered: "delivered",
  cancelled: "cancelled",
};

const JOURNEY: { stage: Stage; title: string; who: string; tint: string }[] = [
  { stage: "free", title: "Free first", who: "NGOs, schools & people in need", tint: "bg-lime" },
  { stage: "marketplace", title: "Marketplace", who: "Anyone, at a low price", tint: "bg-sky" },
  { stage: "recycle", title: "Repair / recycle", who: "Repairers & recyclers", tint: "bg-lavender" },
];

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Journey({ listing }: { listing: Listing }) {
  const order: Stage[] = ["free", "marketplace", listing.stage === "expired" ? "expired" : "recycle"];
  const current = order.indexOf(listing.stage);
  const ends: Record<string, string | null> = { free: listing.priority_until, marketplace: listing.marketplace_until };
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Item journey">
      {JOURNEY.map((j, i) => {
        const isExpiredSlot = i === 2 && listing.stage === "expired";
        const active = i === current;
        const done = i < current;
        return (
          <li key={j.stage} className={`rounded-3xl p-3.5 ${active ? `${j.tint} clay-sm` : done ? "bg-cream-2 opacity-70" : "bg-cream"}`} aria-current={active ? "step" : undefined}>
            <span className="text-xs font-extrabold uppercase tracking-wider">Chance {i + 1}{active ? " · now" : done ? " · done" : ""}</span>
            <b className="block font-display text-lg leading-tight">{isExpiredSlot ? "Expired" : j.title}</b>
            <small className="block font-bold opacity-80">{isExpiredSlot ? "Past best-before, compost only" : j.who}</small>
            {ends[j.stage] && i >= current && (
              <small className="mt-1 block text-xs font-bold">{active ? timeLeft(ends[j.stage]) : `until ${dateFmt.format(new Date(ends[j.stage]!))}`}</small>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function OwnerPanel({ listing, onChange }: { listing: Listing; onChange: () => void }) {
  const router = useRouter();
  const { data: claims, error, loading, reload } = useApi<Claim[]>(`/api/listings/${listing.id}/claims`);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  async function act(claimId: number, action: "accept" | "decline" | "complete", el?: HTMLElement) {
    setBusy(`${action}-${claimId}`);
    setActionError("");
    try {
      await api(`/api/claims/${claimId}/${action}`, { method: "POST" });
      if (action === "complete" && el) burstConfetti(el, 60);
      await Promise.all([reload(), onChange()]);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    setBusy("withdraw");
    try {
      await api(`/api/listings/${listing.id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (e) {
      setActionError((e as Error).message);
      setBusy(null);
    }
  }

  const open = (claims ?? []).filter((c) => c.status === "pending" || c.status === "accepted" || c.status === "completed");

  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-bold">Requests for your item</h2>
      {loading ? <LoadingState /> : error ? <ErrorNote>{error}</ErrorNote> : !open.length ? (
        <p className="rounded-2xl bg-cream p-4 font-semibold text-plum-soft">No requests yet. We&apos;ll show them here as soon as someone asks.</p>
      ) : (
        <ul className="grid gap-2.5">
          {open.map((c) => (
            <li key={c.id} className="rounded-3xl bg-cream p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b>{c.claimant.name}</b>
                {c.claimant.verified && <BadgeCheck size={18} className="text-violet" aria-label="Verified" />}
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold">{ROLE_LABEL[c.claimant.role]}</span>
                <span className="ml-auto text-xs font-bold text-plum-soft">{timeAgo(c.created_at)}</span>
              </div>
              {c.message && <p className="mt-1.5 text-sm">“{c.message}”</p>}
              {listing.price_inr != null && c.stage === "marketplace" && (c.status === "accepted" || c.status === "completed") && (
                <p className={`mt-2 w-fit rounded-full px-3 py-1 text-xs font-extrabold ${c.payment_status === "paid" ? "bg-lime" : "bg-cream-2"}`}>
                  {c.payment_status === "paid" ? `💳 Paid ${formatINR(listing.price_inr)}` : c.payment_status === "refunded" ? "↩️ Refunded" : "⏳ Waiting for payment"}
                </p>
              )}
              {c.wants_delivery && (
                <p className="mt-2 w-fit rounded-full bg-butter-t px-3 py-1 text-xs font-extrabold">
                  🚚 Asked for volunteer delivery{c.delivery_status ? ` · ${DELIVERY_LABEL[c.delivery_status]}` : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status === "pending" && listing.status === "active" && (
                  <>
                    <Button size="sm" variant="lime" disabled={!!busy} onClick={() => act(c.id, "accept")}>Accept</Button>
                    <Button size="sm" disabled={!!busy} onClick={() => act(c.id, "decline")}>Decline</Button>
                  </>
                )}
                {c.status === "accepted" && (
                  <Button size="sm" variant="coral" disabled={!!busy} onClick={(e) => act(c.id, "complete", e.currentTarget)}>
                    ✅ {c.wants_delivery ? "Handed over myself" : "Confirm handover"}
                  </Button>
                )}
                {c.status === "completed" && <span className="rounded-full bg-sky-t px-3 py-1 text-sm font-extrabold">🎉 Handed over</span>}
              </div>
              {c.status === "completed" && listing.review_claim_id === c.id && !listing.my_review_stars && (
                <div className="mt-3"><ReviewBox claimId={c.id} otherName={c.claimant.name} onDone={onChange} /></div>
              )}
              {c.status === "completed" && listing.my_review_stars != null && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-plum-soft">You rated them <Stars value={listing.my_review_stars} /></p>
              )}
            </li>
          ))}
        </ul>
      )}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      {listing.status !== "completed" && (
        <div className="mt-2">
          {confirmWithdraw ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-coral-t p-3">
              <span className="font-bold">Remove this listing? Open requests will be declined.</span>
              <Button size="sm" variant="coral" disabled={busy === "withdraw"} onClick={withdraw}>Yes, remove</Button>
              <Button size="sm" onClick={() => setConfirmWithdraw(false)}>Keep it</Button>
            </div>
          ) : (
            <button onClick={() => setConfirmWithdraw(true)} className="text-sm font-bold text-plum-soft underline hover:text-plum">Remove listing</button>
          )}
        </div>
      )}
    </div>
  );
}

function RequestPanel({ listing, onChange }: { listing: Listing; onChange: () => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needId, setNeedId] = useState<string>("");
  const [wantsDelivery, setWantsDelivery] = useState(false);
  const postsNeeds = user?.role === "organisation" || user?.role === "individual";
  const { data: myNeeds } = useApi<Need[]>(postsNeeds && listing.can_claim ? `/api/needs?mine=true&category=${listing.category}` : null);
  const openNeeds = (myNeeds ?? []).filter((n) => n.status === "open");

  async function request(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/listings/${listing.id}/claims`, {
        body: { message, need_id: needId ? Number(needId) : null, wants_delivery: wantsDelivery },
      });
      burstConfetti(btn);
      await onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api(`/api/claims/${listing.my_claim_id}/cancel`, { method: "POST" });
      await onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (listing.my_claim_status && listing.my_claim_status !== "declined") {
    const text: Record<string, string> = {
      pending: "You've requested this. The donor will reply soon.",
      accepted: listing.my_delivery_status && listing.my_delivery_status !== "cancelled"
        ? `The donor accepted! A volunteer will bring it. Delivery: ${DELIVERY_LABEL[listing.my_delivery_status]}.`
        : "The donor accepted your request! Arrange pickup with them.",
      completed: "You received this item. Thank you for giving it a second life! 🎉",
      cancelled: "You cancelled your request.",
    };
    const owesPayment = listing.my_claim_status === "accepted" && listing.price_inr != null && listing.my_payment_status !== "paid"
      && listing.stage !== "free" && listing.my_claim_id != null;
    return (
      <div className="grid gap-3">
        <p className="rounded-2xl bg-lime-t p-4 font-bold">{text[listing.my_claim_status]}</p>
        {owesPayment && listing.price_inr != null && (
          <div className="grid gap-2 rounded-2xl bg-sky-t p-3">
            <p className="text-sm font-bold">Pay to confirm your purchase. The donor hands it over once you&apos;ve paid.</p>
            <PayButton claimId={listing.my_claim_id!} amount={listing.price_inr} onPaid={onChange} />
          </div>
        )}
        {listing.my_payment_status === "paid" && <p className="rounded-2xl bg-lime px-3 py-2 text-sm font-extrabold">💳 Paid {listing.price_inr != null ? formatINR(listing.price_inr) : ""}. Payment verified</p>}
        {listing.my_payment_status === "refunded" && <p className="rounded-2xl bg-cream-2 px-3 py-2 text-sm font-extrabold">↩️ Your payment was refunded</p>}
        {listing.my_claim_status === "completed" && listing.review_claim_id && !listing.my_review_stars && (
          <ReviewBox claimId={listing.review_claim_id} otherName={listing.donor.name} onDone={onChange} />
        )}
        {listing.my_claim_status === "completed" && listing.my_review_stars != null && (
          <p className="flex items-center gap-1.5 text-sm font-bold text-plum-soft">You rated the donor <Stars value={listing.my_review_stars} /></p>
        )}
        {(listing.my_claim_status === "pending" || listing.my_claim_status === "accepted") && (
          <button onClick={cancel} disabled={busy} className="justify-self-start text-sm font-bold text-plum-soft underline hover:text-plum">Cancel my request</button>
        )}
        {err && <ErrorNote>{err}</ErrorNote>}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid gap-3">
        <p className="font-semibold text-plum-soft">Sign in to request this item.</p>
        <ButtonLink href={`/login?next=/listings/${listing.id}`} variant="lavender">Sign in to request</ButtonLink>
      </div>
    );
  }

  if (!listing.can_claim) {
    return <p className="rounded-2xl bg-butter-t p-4 font-bold">{listing.claim_blocked_reason}</p>;
  }

  const label =
    listing.stage === "free" ? "🎁 Request for free"
    : listing.stage === "marketplace" ? (listing.price_inr != null ? `🏷️ Reserve for ${formatINR(listing.price_inr)}` : "🏷️ Make an offer")
    : "♻️ Request to repair / recycle";

  return (
    <div className="grid gap-3">
      <label htmlFor="msg" className="font-display text-lg font-bold">Add a note for the donor <span className="font-sans text-sm text-plum-soft">(optional)</span></label>
      <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="Who is it for, and when can you pick it up?" />
      {openNeeds.length > 0 && (
        <div>
          <label htmlFor="for-need" className="mb-1 block text-sm font-bold">Which of your needs is this for?</label>
          <Select id="for-need" value={needId} onChange={(e) => setNeedId(e.target.value)}>
            <option value="">Not for a posted need</option>
            {openNeeds.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </Select>
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-butter-t p-3 text-sm font-semibold">
        <input type="checkbox" checked={wantsDelivery} onChange={(e) => setWantsDelivery(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8C6BEA]" />
        <span>🚚 <b>Ask a volunteer to deliver it</b>
          <span className="block text-plum-soft">Once the donor accepts, nearby volunteers can pick it up and bring it to {needId ? "your need's location" : "you"}.</span>
        </span>
      </label>
      <Button variant="coral" onClick={request} disabled={busy}>{busy ? "Sending…" : label}</Button>
      {listing.stage === "marketplace" && <p className="text-xs font-semibold text-plum-soft">Online payment (UPI) is coming soon. For now you pay the donor at pickup.</p>}
      {err && <ErrorNote>{err}</ErrorNote>}
    </div>
  );
}

function WhoNeedsThis({ listingId }: { listingId: number }) {
  const { data, loading } = useApi<NeedMatch[]>(`/api/listings/${listingId}/matches?limit=4`);
  if (loading || !data?.length) return null;
  return (
    <section className="clay rounded-[2.25rem] bg-lavender-t p-5" aria-label="Who needs this">
      <h2 className="text-xl font-bold">✨ Who needs this?</h2>
      <p className="text-sm font-semibold text-plum-soft">Posted needs your item could fill, best match first. They see your item in their suggestions too.</p>
      <ul className="mt-3 grid gap-2.5">
        {data.map((m) => (
          <li key={m.need.id} className="rounded-3xl bg-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <b className="block">{m.need.title}</b>
                <small className="flex items-center gap-1 font-bold text-plum-soft">
                  {m.need.requester.name}
                  {m.need.requester.verified && <BadgeCheck size={14} className="text-violet" aria-label="Verified" />}
                </small>
              </div>
              <MatchScore score={m.score} components={m.components} />
            </div>
            <div className="mt-2"><ReasonChips reasons={m.reasons} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WhereCard({ listing }: { listing: Listing & { lat: number; lng: number } }) {
  const point = { lat: listing.lat, lng: listing.lng };
  const markers = useMemo(() => {
    const m = listingMarker(listing);
    return m ? [{ ...m, popup: undefined }] : [];
  }, [listing]);
  return (
    <section className="clay overflow-hidden rounded-[2.25rem] bg-card" aria-label="Pickup area">
      <ClayMap center={point} zoom={14} markers={markers} radiusKm={listing.location_exact ? null : 0.2} className="h-52 w-full" label="Pickup area map" />
      <p className="px-5 py-3 text-sm font-bold text-plum-soft">
        📍 {[listing.area, listing.city].filter(Boolean).join(", ")}
        {listing.location_exact
          ? listing.is_owner ? " · exact spot (only you and an accepted requester see this)" : " · exact pickup spot"
          : " · approximate area. The exact spot is shared once the donor accepts your request."}
      </p>
    </section>
  );
}

function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { data: listing, error, loading, reload } = useApi<Listing>(`/api/listings/${id}`);
  const [photoIdx, setPhotoIdx] = useState(0);
  const { user } = useAuth();

  if (loading && !listing) return <LoadingState />;
  if (error || !listing) return <EmptyState title="We couldn't find that item" action={<ButtonLink href="/listings">Back to explore</ButtonLink>}>{error ?? "It may have been removed."}</EmptyState>;

  const tile = tileFor(listing.category);
  return (
    <>
      <Link href="/listings" className="mb-4 inline-flex items-center gap-1.5 font-bold text-plum-soft hover:text-plum"><ArrowLeft size={18} /> All items</Link>
      {isNew && listing.is_owner && (
        <p className="mb-4 rounded-2xl bg-lime px-4 py-3 font-bold">🌱 Your item is live! NGOs and people nearby can request it now.</p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="clay min-w-0 rounded-[2.25rem] bg-card p-5 sm:p-7">
          <div className={`relative grid h-56 place-items-center overflow-hidden rounded-[1.75rem] sm:h-72 ${tile.tint}`}>
            {listing.photos[photoIdx] ? (
              // eslint-disable-next-line @next/next/no-img-element -- user uploads served by the API
              <img src={listing.photos[photoIdx]} alt={listing.title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="text-8xl" aria-hidden="true">{tile.icon}</span>
            )}
            <span className="absolute left-4 top-4"><StageChip stage={listing.stage} /></span>
            {listing.status !== "active" && (
              <span className="absolute right-4 top-4 rounded-full bg-plum px-3 py-1 text-xs font-extrabold capitalize text-white">{listing.status}</span>
            )}
          </div>
          {listing.photos.length > 1 && (
            <div className="mt-3 flex gap-2" role="group" aria-label="Photos">
              {listing.photos.map((src, i) => (
                <button key={src} onClick={() => setPhotoIdx(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === photoIdx}
                  className={`h-16 w-16 overflow-hidden rounded-2xl ${i === photoIdx ? "outline-3 outline-violet" : "opacity-75 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served by the API */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <h1 className="mt-5 text-[clamp(1.7rem,4vw,2.4rem)] font-extrabold">{listing.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5 text-sm font-extrabold">
            <span className="rounded-full bg-sky-t px-3 py-1">📦 {formatQty(listing.quantity, listing.unit)}</span>
            <span className="rounded-full bg-butter-t px-3 py-1">✓ {CONDITION_LABEL[listing.condition]}</span>
            <span className="rounded-full bg-mint-t px-3 py-1">📍 {[listing.area, listing.city].filter(Boolean).join(", ")}</span>
            {listing.subcategory && <span className="rounded-full bg-lavender-t px-3 py-1">{listing.subcategory}</span>}
            {listing.price_inr != null && <span className="rounded-full bg-coral-t px-3 py-1">Marketplace price {formatINR(listing.price_inr)}</span>}
          </div>
          {listing.description && <p className="mt-4 whitespace-pre-line text-lg">{listing.description}</p>}
          <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm font-bold text-plum-soft">
            Shared by <Link href={`/u/${listing.donor.id}`} className="text-violet hover:underline">{listing.donor.name}</Link>
            {listing.donor.verified && <BadgeCheck size={16} className="text-violet" aria-label="Verified" />}
            · {ROLE_LABEL[listing.donor.role]} · {timeAgo(listing.created_at)}
          </p>
          <div className="mt-6"><Journey listing={listing} /></div>
          {user && !listing.is_owner && <div className="mt-4"><ReportButton targetType="listing" targetId={listing.id} label="Report this listing" /></div>}
        </article>

        <div className="grid h-fit gap-5">
          <aside className="clay rounded-[2.25rem] bg-card p-5 sm:p-6">
            {listing.is_owner ? <OwnerPanel listing={listing} onChange={reload} /> : <RequestPanel listing={listing} onChange={reload} />}
          </aside>
          {listing.is_owner && listing.status === "active" && <WhoNeedsThis listingId={listing.id} />}
          {listing.lat != null && listing.lng != null && <WhereCard listing={listing as Listing & { lat: number; lng: number }} />}
        </div>
      </div>
    </>
  );
}

export default function ListingPage() {
  return (
    <PageShell>
      <Suspense>
        <ListingDetail />
      </Suspense>
    </PageShell>
  );
}
