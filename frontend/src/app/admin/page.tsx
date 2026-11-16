"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, BadgeCheck, Flag, ShieldAlert } from "lucide-react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/FormBits";
import { api } from "@/lib/api";
import { formatINR, ROLE_LABEL, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { UserBrief } from "@/lib/types";

interface Overview { users: number; pending_verifications: number; open_reports: number; handovers: number; marketplace_sales_inr: number; platform_fees_inr: number }
interface Verification { id: number; kind: string; reference: string; note: string; created_at: string; user: UserBrief }
interface ReportRow { id: number; target_type: string; target_id: number; target_label: string; reason: string; details: string; created_at: string; reporter: UserBrief }
interface Risk { user: UserBrief; score: number; signals: { code: string; weight: number; detail: string }[] }

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="clay-sm rounded-[1.75rem] bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">{icon} {title}</h2>
      {children}
    </section>
  );
}

function VerificationQueue({ onChange }: { onChange: () => void }) {
  const { data, reload, error } = useApi<Verification[]>("/api/admin/verifications");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [err, setErr] = useState("");
  async function decide(id: number, action: "approve" | "reject") {
    setErr("");
    try {
      await api(`/api/admin/verifications/${id}/${action}`, { body: { note: notes[id] ?? "" } });
      await reload();
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.length) return <p className="font-semibold text-plum-soft">Nothing waiting. 🎉</p>;
  return (
    <ul className="grid gap-3">
      {data.map((v) => (
        <li key={v.id} className="rounded-3xl bg-cream p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b>{v.user.name}</b><span className="text-xs font-bold text-plum-soft">{timeAgo(v.created_at)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold">{v.kind === "darpan" ? "NGO Darpan ID" : v.kind === "udise" ? "UDISE+ code" : "Registration"}: <code className="rounded bg-card px-1.5 py-0.5 font-bold">{v.reference}</code></p>
          {v.note && <p className="mt-1 text-sm">“{v.note}”</p>}
          <p className="mt-1 text-xs font-semibold text-plum-soft">Check the number on the official portal before approving. Format is already validated.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input value={notes[v.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [v.id]: e.target.value }))} placeholder="Note to the organisation (required to reject)" className="min-w-0 flex-1 py-2" aria-label="Review note" />
            <Button size="sm" variant="lime" onClick={() => decide(v.id, "approve")}>Approve</Button>
            <Button size="sm" onClick={() => decide(v.id, "reject")}>Reject</Button>
          </div>
        </li>
      ))}
      {err && <ErrorNote>{err}</ErrorNote>}
    </ul>
  );
}

function Reports({ onChange }: { onChange: () => void }) {
  const { data, reload } = useApi<ReportRow[]>("/api/admin/reports");
  async function close(id: number, action: "resolve" | "dismiss") {
    await api(`/api/admin/reports/${id}/${action}`, { method: "POST" });
    await reload();
    onChange();
  }
  if (!data?.length) return <p className="font-semibold text-plum-soft">No open reports.</p>;
  const link = (r: ReportRow) => (r.target_type === "listing" ? `/listings/${r.target_id}` : r.target_type === "user" ? `/u/${r.target_id}` : "/needs");
  return (
    <ul className="grid gap-3">
      {data.map((r) => (
        <li key={r.id} className="rounded-3xl bg-cream p-4">
          <p className="text-sm font-bold"><span className="rounded-full bg-coral-t px-2 py-0.5 text-xs font-extrabold">{r.reason}</span>{" "}
            {r.target_type} <Link href={link(r)} className="text-violet hover:underline">{r.target_label}</Link></p>
          {r.details && <p className="mt-1 text-sm">“{r.details}”</p>}
          <p className="mt-1 text-xs font-bold text-plum-soft">by {r.reporter.name} · {timeAgo(r.created_at)}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="coral" onClick={() => close(r.id, "resolve")}>Action taken</Button>
            <Button size="sm" onClick={() => close(r.id, "dismiss")}>Dismiss</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RiskList() {
  const { data } = useApi<Risk[]>("/api/admin/risk");
  if (!data?.length) return <p className="font-semibold text-plum-soft">No unusual patterns in the last 30 days.</p>;
  return (
    <ul className="grid gap-2.5">
      {data.map((r) => (
        <li key={r.user.id} className="rounded-3xl bg-cream p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/u/${r.user.id}`} className="font-bold hover:underline">{r.user.name}</Link>
            <span className="rounded-full bg-butter px-2 py-0.5 text-xs font-extrabold">risk {r.score} · {ROLE_LABEL[r.user.role]}</span>
          </div>
          <ul className="mt-1 grid gap-0.5 text-sm font-semibold text-plum-soft">
            {r.signals.map((s, i) => <li key={i}>⚠️ {s.detail}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Console() {
  const { data: o, reload } = useApi<Overview>("/api/admin/overview");
  return (
    <>
      <h1 className="mb-1 text-[clamp(2rem,4vw,2.8rem)] font-extrabold">Trust &amp; safety console</h1>
      <p className="mb-5 text-plum-soft">Signals never block anyone automatically. They bring an account to a person&apos;s attention.</p>
      {o && (
        <dl className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
          {[["Members", o.users.toLocaleString("en-IN")], ["Handovers", o.handovers.toLocaleString("en-IN")], ["Waiting verification", o.pending_verifications],
            ["Open reports", o.open_reports], ["Marketplace sales", formatINR(o.marketplace_sales_inr)], ["Platform fees", formatINR(o.platform_fees_inr)]].map(([k, v]) => (
            <div key={k as string} className="clay-sm rounded-3xl bg-card px-4 py-3"><dt className="text-xs font-bold text-plum-soft">{k}</dt><dd className="text-2xl font-extrabold">{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Organisations waiting for verification" icon={<BadgeCheck className="text-violet" aria-hidden="true" />}><VerificationQueue onChange={reload} /></Card>
        <Card title="Reports" icon={<Flag className="text-coral" aria-hidden="true" />}><Reports onChange={reload} /></Card>
        <Card title="Unusual patterns (last 30 days)" icon={<ShieldAlert className="text-violet" aria-hidden="true" />}><RiskList /></Card>
        <Card title="What the signals mean" icon={<AlertTriangle className="text-[#D9A400]" aria-hidden="true" />}>
          <ul className="grid gap-1.5 text-sm font-semibold text-plum-soft">
            <li><b className="text-plum">Possible resale</b>: received an item free, then listed the same kind of item with a price within a week.</li>
            <li><b className="text-plum">Many free requests</b>: an individual requested 5+ free items in 30 days.</li>
            <li><b className="text-plum">Frequent cancellations</b>: most of 3+ requests cancelled.</li>
            <li><b className="text-plum">New account, large requests</b>: under a week old with ₹20,000+ of purchases or 3+ free requests.</li>
            <li><b className="text-plum">Reported</b>: two or more people reported this member.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <PageShell>
      <RequireAuth>
        {(user) => user.role === "admin" ? <Console /> : <EmptyState title="Admins only">This page is for the REBIRTH trust &amp; safety team.</EmptyState>}
      </RequireAuth>
    </PageShell>
  );
}
