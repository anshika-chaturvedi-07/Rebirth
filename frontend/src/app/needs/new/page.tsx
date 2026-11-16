"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Character } from "@/components/characters/Character";
import { PageShell } from "@/components/layout/PageShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/EmptyState";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/FormBits";
import { api } from "@/lib/api";
import { CATEGORY_TILES } from "@/lib/categories";
import { URGENCY } from "@/lib/format";
import { useCategories } from "@/lib/hooks";
import type { User } from "@/lib/types";

function NeedForm({ user }: { user: User }) {
  const router = useRouter();
  const categories = useCategories();
  const [category, setCategory] = useState("furniture");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const unit = categories.find((c) => c.slug === category)?.unit;

  if (!["organisation", "individual", "admin"].includes(user.role)) {
    return (
      <EmptyState title="Needs are posted by NGOs, schools and individuals" action={<ButtonLink href="/needs">See the needs board</ButtonLink>}>
        Your account can give items to these needs. Browse the board to find one you can help with.
      </EmptyState>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const v: Record<string, string> = {};
    if ((d.title ?? "").trim().length < 3) v.title = "Describe what you need in a few words.";
    if (!(Number(d.quantity) > 0)) v.quantity = "How many, or how much?";
    if ((d.city ?? "").trim().length < 2) v.city = "Which city?";
    setErrors(v);
    setFormError("");
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api("/api/needs", {
        body: {
          title: d.title.trim(), description: (d.description ?? "").trim(), category, quantity: Number(d.quantity),
          urgency: Number(d.urgency), city: d.city.trim(), area: (d.area ?? "").trim(),
          needed_by: d.needed_by ? new Date(d.needed_by).toISOString() : null,
        },
      });
      router.push("/dashboard");
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <form onSubmit={onSubmit} noValidate className="clay grid gap-5 rounded-[2.25rem] bg-card p-6 sm:p-8">
        <div>
          <h1 className="text-[2.2rem] font-extrabold">Post a need</h1>
          <p className="text-plum-soft">Donors nearby see this on the needs board. Be specific so the right things reach you.</p>
        </div>
        <fieldset>
          <legend className="mb-2 font-display text-[1.05rem] font-bold">Category</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {CATEGORY_TILES.map((c) => (
              <label key={c.slug} className={`cursor-pointer rounded-2xl p-2 text-center text-xs font-bold ${c.tint} ${category === c.slug ? "clay-sm outline-3 outline-plum/40" : ""}`}>
                <input type="radio" name="category" value={c.slug} checked={category === c.slug} onChange={() => setCategory(c.slug)} className="sr-only" />
                <span className="block text-2xl" aria-hidden="true">{c.icon}</span>{c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">What do you need?</Label>
            <Input id="title" name="title" maxLength={140} placeholder="e.g. Chairs for two new classrooms" aria-describedby="title-err" />
            <FieldError id="title-err">{errors.title}</FieldError>
          </div>
          <div>
            <Label htmlFor="quantity" hint={unit ? `in ${unit}` : undefined}>Quantity</Label>
            <Input id="quantity" name="quantity" type="number" min="0.1" step="any" defaultValue={1} aria-describedby="qty-err" />
            <FieldError id="qty-err">{errors.quantity}</FieldError>
          </div>
          <div>
            <Label htmlFor="urgency">How urgent?</Label>
            <Select id="urgency" name="urgency" defaultValue="2">
              {([3, 2, 1] as const).map((u) => <option key={u} value={u}>{URGENCY[u].label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="area">Area / locality</Label>
            <Input id="area" name="area" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={user.city} aria-describedby="city-err" />
            <FieldError id="city-err">{errors.city}</FieldError>
          </div>
          <div>
            <Label htmlFor="needed_by" hint="optional">Needed by</Label>
            <Input id="needed_by" name="needed_by" type="date" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description" hint="optional">Why it matters</Label>
            <Textarea id="description" name="description" maxLength={2000} placeholder="Who will it help? Any sizes or specifics?" />
          </div>
        </div>
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <Button type="submit" variant="lavender" disabled={busy} className="w-full sm:w-auto sm:justify-self-start">{busy ? "Posting…" : "Post need"}</Button>
      </form>
      <aside className="clay h-fit rounded-[2rem] bg-blush-t p-5 text-center">
        <Character id="fatima" className="mx-auto w-32" />
        <p className="mt-2 font-semibold">Ms. Fatima furnished two classrooms this way. Clear, specific needs get matched fastest.</p>
      </aside>
    </div>
  );
}

export default function NewNeedPage() {
  return (
    <PageShell>
      <RequireAuth>{(user) => <NeedForm user={user} />}</RequireAuth>
    </PageShell>
  );
}
