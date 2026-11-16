"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Character } from "@/components/characters/Character";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/EmptyState";
import { LocationPicker, type PickedLocation } from "@/components/map/LocationPicker";
import { PhotoSnap, type UploadedPhoto, type VisionResult } from "@/components/listings/PhotoSnap";
import { FieldError, Input, Label, localDateTime, Select, Textarea } from "@/components/ui/FormBits";
import { api } from "@/lib/api";
import { CATEGORY_TILES } from "@/lib/categories";
import { burstConfetti } from "@/lib/confetti";
import { CONDITION_LABEL } from "@/lib/format";
import { useCategories } from "@/lib/hooks";
import type { Condition, Listing, User } from "@/lib/types";

function hoursLabel(h: number) {
  return h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`;
}

function NewListingForm({ user }: { user: User }) {
  const router = useRouter();
  const categories = useCategories();
  const [category, setCategory] = useState("electronics");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [subcategory, setSubcategory] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [aiFilled, setAiFilled] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const cat = categories.find((c) => c.slug === category);

  // Apply AI suggestions without overwriting anything the donor typed themselves.
  const applySuggestion = useCallback(
    (r: VisionResult, pick?: string) => {
      const slug = pick ?? (r.confident ? r.category : null);
      if (!slug) return;
      const sameAsAi = slug === r.category;
      setCategory(slug);
      setSubcategory(sameAsAi ? (r.subcategory ?? "") : "");
      if (sameAsAi && r.title && !titleTouched) setTitle(r.title);
      if (sameAsAi && r.condition) setCondition(r.condition);
      setAiFilled(true);
    },
    [titleTouched],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const btn = e.currentTarget.querySelector("button[type=submit]")!;
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const v: Record<string, string> = {};
    if ((d.title ?? "").trim().length < 3) v.title = "Give it a short name, e.g. “Working laptop”.";
    const qty = Number(d.quantity);
    if (!(qty > 0)) v.quantity = "How many, or how much?";
    if ((d.city ?? "").trim().length < 2) v.city = "Which city is it in?";
    if (cat?.perishable && !d.best_before) v.best_before = "Food needs a best-before time.";
    if (d.best_before && new Date(d.best_before).getTime() <= Date.now()) v.best_before = "Best-before must be in the future.";
    setErrors(v);
    setFormError("");
    if (Object.keys(v).length) return;

    setBusy(true);
    try {
      const listing = await api<Listing>("/api/listings", {
        body: {
          title: d.title.trim(),
          description: (d.description ?? "").trim(),
          category,
          subcategory: subcategory || null,
          quantity: qty,
          condition,
          city: d.city.trim(),
          area: (d.area ?? "").trim(),
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          original_price_inr: d.original_price_inr ? Number(d.original_price_inr) : null,
          best_before: d.best_before ? new Date(d.best_before).toISOString() : null,
          photo_ids: photos.map((p) => p.id),
        },
      });
      burstConfetti(btn);
      router.push(`/listings/${listing.id}?new=1`);
    } catch (err) {
      setFormError((err as Error).message);
      setBusy(false);
    }
  }

  if (user.role === "volunteer") {
    return <EmptyState title="Volunteers deliver, donors list">Volunteer accounts can&apos;t list items. Create a donor account if you also want to give things away.</EmptyState>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form onSubmit={onSubmit} noValidate className="clay grid gap-5 rounded-[2.25rem] bg-card p-6 sm:p-8">
        <div>
          <h1 className="text-[2.2rem] font-extrabold">Give something a second chance</h1>
          <p className="text-plum-soft">It&apos;s free for NGOs and people in need first. You can withdraw it any time.</p>
        </div>

        <PhotoSnap photos={photos} onPhotosChange={setPhotos} onSuggest={applySuggestion} onBlockedChange={setBlocked} />

        <fieldset>
          <legend className="mb-2 font-display text-[1.05rem] font-bold">
            What kind of thing is it? {aiFilled && <span className="ml-1 rounded-full bg-lavender-t px-2 py-0.5 font-sans text-xs font-extrabold text-violet">✨ AI suggested</span>}
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {CATEGORY_TILES.map((c) => (
              <label key={c.slug} className={`cursor-pointer rounded-2xl p-2 text-center text-xs font-bold transition-transform hover:-translate-y-0.5 ${c.tint} ${category === c.slug ? "clay-sm outline-3 outline-plum/40 -translate-y-0.5" : ""}`}>
                <input type="radio" name="category" value={c.slug} checked={category === c.slug} onChange={() => { setCategory(c.slug); setSubcategory(""); }} className="sr-only" />
                <span className="block text-2xl" aria-hidden="true">{c.icon}</span>
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" maxLength={140} placeholder="e.g. Dell laptop, working, with charger" aria-describedby="title-err"
              value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
            <FieldError id="title-err">{errors.title}</FieldError>
          </div>
          {!!cat?.subcategories.length && (
            <div>
              <Label htmlFor="subcategory">Type</Label>
              <Select id="subcategory" name="subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                <option value="">Choose…</option>
                {cat.subcategories.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="quantity" hint={cat ? `in ${cat.unit}` : undefined}>Quantity</Label>
            <Input id="quantity" name="quantity" type="number" min="0.1" step="any" defaultValue={1} aria-describedby="qty-err" />
            <FieldError id="qty-err">{errors.quantity}</FieldError>
          </div>
          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select id="condition" name="condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
              {Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          {cat?.perishable ? (
            <div>
              <Label htmlFor="best_before">Best before</Label>
              <Input id="best_before" name="best_before" type="datetime-local" defaultValue={localDateTime(4)} aria-describedby="bb-err" />
              <FieldError id="bb-err">{errors.best_before}</FieldError>
            </div>
          ) : (
            <div>
              <Label htmlFor="original_price_inr" hint="optional">Original price (₹)</Label>
              <Input id="original_price_inr" name="original_price_inr" type="number" min="0" step="1" placeholder="Helps us suggest a fair resale price" />
            </div>
          )}
          <div className="sm:col-span-2">
            <LocationPicker defaultCity={user.city} onChange={setLoc} cityError={errors.city} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description" hint="optional">Details</Label>
            <Textarea id="description" name="description" maxLength={2000} placeholder="Size, what's included, pickup timings…" />
          </div>
        </div>

        {formError && <ErrorNote>{formError}</ErrorNote>}
        {blocked && <ErrorNote>This item can&apos;t be listed on REBIRTH. Remove the photo if it was a mistake.</ErrorNote>}
        <Button type="submit" variant="coral" disabled={busy || blocked} className="w-full sm:w-auto sm:justify-self-start">
          {busy ? "Listing…" : "List it 🌱"}
        </Button>
      </form>

      <aside className="clay h-fit rounded-[2rem] bg-lime-t p-5">
        <Character id="meera" className="mx-auto -mt-2 w-32" />
        <h2 className="mt-2 text-xl font-bold">What happens next</h2>
        <ol className="mt-2 grid gap-2 text-sm font-semibold">
          <li className="rounded-2xl bg-white/70 p-3">
            🎁 <b>Free</b> for NGOs, schools and people in need
            {cat ? ` for ${hoursLabel(cat.priority_window_hours)}` : ""}.
          </li>
          <li className="rounded-2xl bg-white/70 p-3">🏷️ If nobody claims it, it moves to the <b>marketplace</b> at a fair low price.</li>
          <li className="rounded-2xl bg-white/70 p-3">♻️ Finally <b>repairers and recyclers</b> can take it. It never goes to the bin.</li>
        </ol>
      </aside>
    </div>
  );
}

export default function NewListingPage() {
  return (
    <PageShell>
      <RequireAuth>{(user) => <NewListingForm user={user} />}</RequireAuth>
    </PageShell>
  );
}
