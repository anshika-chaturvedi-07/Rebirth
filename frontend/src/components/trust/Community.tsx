"use client";

import { useState } from "react";
import { Flag, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/FormBits";
import { api } from "@/lib/api";

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? "fill-butter text-[#D9A400]" : "text-cream-2"} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Rate the other side of a completed handover (once). */
export function ReviewBox({ claimId, otherName, onDone }: { claimId: number; otherName: string; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!stars) return setError("Choose 1 to 5 stars.");
    setBusy(true);
    setError("");
    try {
      await api(`/api/claims/${claimId}/review`, { body: { stars, comment } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2.5 rounded-3xl bg-butter-t p-4">
      <p className="font-display text-lg font-bold">How was the handover with {otherName}?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={stars === i} aria-label={`${i} star${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)} onClick={() => setStars(i)} className="transition-transform hover:scale-110">
            <Star size={28} className={i <= (hover || stars) ? "fill-butter text-[#D9A400]" : "text-plum-soft/40"} />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Optional: a sentence others will find helpful" className="min-h-16" aria-label="Review comment" />
      <Button variant="lavender" size="sm" onClick={submit} disabled={busy} className="justify-self-start">{busy ? "Sending…" : "Post review"}</Button>
      {error && <p role="alert" className="text-sm font-bold text-[#D9534F]">{error}</p>}
    </div>
  );
}

const REASONS = [
  ["misleading", "Misleading or wrong details"],
  ["unsafe", "Unsafe item (e.g. spoiled food, recalled product)"],
  ["resale", "Free item being resold"],
  ["spam", "Spam or advertising"],
  ["abuse", "Rude or abusive behaviour"],
  ["other", "Something else"],
] as const;

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "listing" | "need" | "user"; targetId: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("misleading");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  async function send() {
    setState("busy");
    setError("");
    try {
      await api("/api/reports", { body: { target_type: targetType, target_id: targetId, reason, details } });
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  if (state === "sent") return <p className="text-sm font-bold text-plum-soft" role="status">Thanks. Our team will take a look.</p>;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-bold text-plum-soft underline hover:text-plum">
        <Flag size={14} aria-hidden="true" /> {label}
      </button>
    );
  return (
    <div className="grid gap-2 rounded-2xl bg-cream p-3">
      <label htmlFor="report-reason" className="text-sm font-bold">What&apos;s wrong?</label>
      <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Anything that helps us check (optional)" className="min-h-16" aria-label="Details" />
      <div className="flex gap-2">
        <Button size="sm" variant="coral" onClick={send} disabled={state === "busy"}>Send report</Button>
        <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p role="alert" className="text-sm font-bold text-[#D9534F]">{error}</p>}
    </div>
  );
}
