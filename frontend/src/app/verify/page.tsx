"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Character } from "@/components/characters/Character";
import { PageShell } from "@/components/layout/PageShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/EmptyState";
import { Input, Label, Select, Textarea } from "@/components/ui/FormBits";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { User } from "@/lib/types";

interface Req { id: number; kind: string; reference: string; status: "pending" | "approved" | "rejected"; review_note: string; created_at: string }

const KINDS = {
  darpan: { label: "NGO Darpan ID (NITI Aayog)", placeholder: "KA/2017/0123456", hint: "State code / year / 7 digits" },
  udise: { label: "School UDISE+ code", placeholder: "29200100101", hint: "11 digits" },
  other: { label: "Other registration number", placeholder: "Trust or society registration", hint: "4–40 letters, digits, / or -" },
} as const;

function VerifyForm({ user }: { user: User }) {
  const { refresh } = useAuth();
  const { data: reqs, reload } = useApi<Req[]>("/api/verification/me");
  const [kind, setKind] = useState<keyof typeof KINDS>("darpan");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user.role !== "organisation") {
    return <EmptyState title="Verification is for NGOs and schools" action={<ButtonLink href="/dashboard">Back to dashboard</ButtonLink>}>Donors and individuals don&apos;t need it.</EmptyState>;
  }
  if (user.verified) {
    return (
      <div className="clay mx-auto max-w-xl rounded-[2rem] bg-lime-t p-8 text-center">
        <BadgeCheck size={48} className="mx-auto text-violet" />
        <h1 className="mt-2 text-3xl font-extrabold">{user.name} is verified</h1>
        <p className="mt-1 text-plum-soft">Donors see the badge on your requests and needs, and matches rank verified organisations higher.</p>
      </div>
    );
  }
  const pending = reqs?.find((r) => r.status === "pending");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/verification", { body: { kind, reference, note } });
      await Promise.all([reload(), refresh()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="clay rounded-[2.25rem] bg-card p-6 sm:p-8">
        <h1 className="text-[2.2rem] font-extrabold">Get your organisation verified</h1>
        <p className="text-plum-soft">A verified badge tells donors their gift reaches a real school or NGO. A REBIRTH admin checks your registration, usually within 2 working days.</p>
        {pending ? (
          <p className="mt-5 rounded-2xl bg-butter-t p-4 font-bold" role="status">⏳ Your {KINDS[pending.kind as keyof typeof KINDS]?.label ?? pending.kind} <b>{pending.reference}</b> was submitted {timeAgo(pending.created_at)} and is waiting for review.</p>
        ) : (
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <div>
              <Label htmlFor="kind">Registration type</Label>
              <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as keyof typeof KINDS)}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="reference" hint={KINDS[kind].hint}>Registration number</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={KINDS[kind].placeholder} required maxLength={40} />
            </div>
            <div>
              <Label htmlFor="note" hint="optional">Anything the reviewer should know</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" variant="lavender" disabled={busy} className="justify-self-start">{busy ? "Sending…" : "Submit for review"}</Button>
          </form>
        )}
        {reqs?.filter((r) => r.status === "rejected").slice(0, 1).map((r) => (
          <p key={r.id} className="mt-4 rounded-2xl bg-coral-t p-3 text-sm font-bold">Your last request ({r.reference}) wasn&apos;t approved: “{r.review_note}”. You can submit again.</p>
        ))}
      </section>
      <aside className="clay h-fit rounded-[2rem] bg-blush-t p-5 text-center">
        <Character id="fatima" className="mx-auto w-32" />
        <p className="mt-2 font-semibold">Verified organisations are shown first in matches and get the 🛡️ badge.</p>
      </aside>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <PageShell>
      <RequireAuth>{(user) => <VerifyForm user={user} />}</RequireAuth>
    </PageShell>
  );
}
