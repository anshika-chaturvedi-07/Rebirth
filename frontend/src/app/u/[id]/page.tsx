"use client";

import { useParams } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageShell } from "@/components/layout/PageShell";
import { ReportButton, Stars } from "@/components/trust/Community";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { ROLE_LABEL, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Role } from "@/lib/types";

interface Profile {
  id: number;
  name: string;
  role: Role;
  verified: boolean;
  city: string;
  member_since: string;
  rating: { average: number | null; count: number };
  handovers: { given: number; received: number };
  badges: { code: string; name: string; icon: string; description: string }[];
  reviews: { id: number; stars: number; comment: string; created_at: string; author_name: string; author_role: Role }[];
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: p, error, loading } = useApi<Profile>(`/api/users/${id}/profile`);

  return (
    <PageShell>
      {loading ? <LoadingState /> : error || !p ? (
        <EmptyState title="We couldn't find that member" action={<ButtonLink href="/listings">Explore items</ButtonLink>}>{error}</EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <section className="clay h-fit rounded-[2.25rem] bg-card p-6">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-lavender font-display text-4xl font-extrabold text-white">{p.name.charAt(0)}</div>
            <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold">
              {p.name} {p.verified && <BadgeCheck className="text-violet" aria-label="Verified organisation" />}
            </h1>
            <p className="font-bold text-plum-soft">{ROLE_LABEL[p.role]} · {p.city} · member since {new Date(p.member_since).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
            <div className="mt-4 flex items-center gap-2">
              {p.rating.average != null ? (
                <><Stars value={p.rating.average} size={20} /><b>{p.rating.average.toFixed(1)}</b><span className="text-sm font-bold text-plum-soft">({p.rating.count} review{p.rating.count === 1 ? "" : "s"})</span></>
              ) : <span className="text-sm font-bold text-plum-soft">No reviews yet</span>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-lime-t px-3 py-2"><dt className="text-xs font-bold text-plum-soft">Items given</dt><dd className="text-2xl font-extrabold">{p.handovers.given}</dd></div>
              <div className="rounded-2xl bg-sky-t px-3 py-2"><dt className="text-xs font-bold text-plum-soft">Items received</dt><dd className="text-2xl font-extrabold">{p.handovers.received}</dd></div>
            </dl>
            {p.badges.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Badges">
                {p.badges.map((b) => <li key={b.code} title={b.description} className="clay-sm rounded-full bg-butter-t px-3 py-1 text-sm font-bold">{b.icon} {b.name}</li>)}
              </ul>
            )}
            {user && user.id !== p.id && <div className="mt-5"><ReportButton targetType="user" targetId={p.id} label="Report this member" /></div>}
          </section>
          <section className="clay-sm rounded-[2rem] bg-card p-6" aria-label="Reviews">
            <h2 className="text-2xl font-extrabold">What people say</h2>
            {!p.reviews.length ? <p className="mt-2 font-semibold text-plum-soft">Reviews appear after completed handovers.</p> : (
              <ul className="mt-3 grid gap-3">
                {p.reviews.map((r) => (
                  <li key={r.id} className="rounded-3xl bg-cream p-4">
                    <div className="flex flex-wrap items-center gap-2"><Stars value={r.stars} /><b className="text-sm">{r.author_name}</b>
                      <span className="text-xs font-bold text-plum-soft">· {ROLE_LABEL[r.author_role]} · {timeAgo(r.created_at)}</span></div>
                    {r.comment && <p className="mt-1.5">“{r.comment}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
