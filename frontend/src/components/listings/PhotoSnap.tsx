"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Sparkles, X } from "lucide-react";
import { Chhotu } from "@/components/characters/Chhotu";
import { api, apiUpload } from "@/lib/api";
import { CONDITION_LABEL } from "@/lib/format";
import type { Condition } from "@/lib/types";

export interface UploadedPhoto {
  id: number;
  url: string;
}

export interface VisionResult {
  is_item: boolean;
  confident: boolean;
  category: string | null;
  subcategory: string | null;
  title: string | null;
  condition: Condition | null;
  condition_confidence: number | null;
  alternatives: { category: string; name: string; icon: string; confidence: number }[];
  warnings: string[];
  blocked: boolean;
  model: string;
  seconds: number;
}

interface VisionStatus {
  available: boolean;
  ready: boolean;
}

const MAX_PHOTOS = 4;
const MAX_MB = 8;

interface Props {
  photos: UploadedPhoto[];
  onPhotosChange: (p: UploadedPhoto[]) => void;
  /** Called with the AI result for the first photo; `pick` is set when the user chooses an alternative category. */
  onSuggest: (r: VisionResult, pick?: string) => void;
  onBlockedChange: (blocked: boolean) => void;
}

export function PhotoSnap({ photos, onPhotosChange, onSuggest, onBlockedChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<VisionStatus | null>(null);
  const [uploading, setUploading] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const analysedId = useRef<number | null>(null);

  useEffect(() => {
    api<VisionStatus>("/api/vision/status").then(setStatus).catch(() => setStatus({ available: false, ready: false }));
  }, []);

  // analyse the cover photo whenever it changes
  const cover = photos[0];
  useEffect(() => {
    if (!cover || !status?.available || analysedId.current === cover.id) return;
    analysedId.current = cover.id;
    setAnalysing(true);
    setError(null);
    api<VisionResult>("/api/vision/analyze", { body: { photo_id: cover.id } })
      .then((r) => {
        setResult(r);
        onBlockedChange(r.blocked);
        if (r.is_item && !r.blocked) onSuggest(r);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        setAnalysing(false);
        setStatus((s) => (s ? { ...s, ready: true } : s));
      });
  }, [cover, status?.available, onSuggest, onBlockedChange]);

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!chosen.length) {
      setError(room <= 0 ? `You can add up to ${MAX_PHOTOS} photos.` : "Choose a JPEG, PNG or WebP photo.");
      return;
    }
    const tooBig = chosen.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`“${tooBig.name}” is bigger than ${MAX_MB} MB.`);
      return;
    }
    setUploading(chosen.length);
    const added: UploadedPhoto[] = [];
    for (const f of chosen) {
      try {
        added.push(await apiUpload<UploadedPhoto>("/api/photos", f));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onPhotosChange([...photos, ...added]);
  }

  async function remove(p: UploadedPhoto) {
    onPhotosChange(photos.filter((x) => x.id !== p.id));
    if (p.id === cover?.id) {
      setResult(null);
      onBlockedChange(false);
    }
    api(`/api/photos/${p.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  const busy = uploading > 0 || analysing;

  return (
    <section className="grid gap-3" aria-label="Photos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[1.05rem] font-bold">📸 Snap it first <span className="font-sans text-sm font-semibold text-plum-soft">up to {MAX_PHOTOS} photos</span></h2>
        {status?.available && <span className="flex items-center gap-1 rounded-full bg-lavender-t px-2.5 py-1 text-xs font-extrabold text-violet"><Sparkles size={14} /> AI fills in the details</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <figure key={p.id} className="clay-sm relative aspect-square overflow-hidden rounded-3xl bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served by the API */}
            <img src={p.url} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <figcaption className="absolute left-2 top-2 rounded-full bg-card px-2 py-0.5 text-[11px] font-extrabold">Cover</figcaption>}
            {i === 0 && analysing && (
              <div className="absolute inset-0 grid place-items-center bg-lavender/40">
                <div className="h-1 w-full animate-[scan_1.4s_ease-in-out_infinite] bg-white shadow-[0_0_14px_4px_white]" />
              </div>
            )}
            <button type="button" onClick={() => remove(p)} aria-label={`Remove photo ${i + 1}`}
              className="clay-sm absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-card hover:bg-coral-t">
              <X size={15} />
            </button>
          </figure>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            disabled={uploading > 0}
            className={`grid aspect-square place-items-center rounded-3xl border-[3px] border-dashed p-3 text-center font-bold transition-colors ${
              dragOver ? "border-violet bg-lavender-t" : "border-lavender/60 bg-cream hover:bg-lavender-t"
            } ${photos.length === 0 ? "col-span-2 aspect-auto min-h-36 sm:col-span-2" : ""}`}
          >
            <span className="grid justify-items-center gap-1">
              <Camera size={28} className="text-violet" aria-hidden="true" />
              {uploading > 0 ? "Uploading…" : photos.length === 0 ? "Add a photo or drop it here" : "Add more"}
              {photos.length === 0 && <small className="font-semibold text-plum-soft">Location data in photos is removed automatically</small>}
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1}
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

      {/* AI result */}
      {analysing && (
        <div className="flex items-center gap-3 rounded-3xl bg-lavender-t p-3 font-bold" role="status">
          <Chhotu className="w-14 flex-none animate-bob" />
          {status?.ready ? "Chhotu is sniffing your photo…" : "Waking up the AI. The first photo takes a little longer…"}
        </div>
      )}
      {!busy && result && <AiCard result={result} onPick={(slug) => onSuggest(result, slug)} />}
      {!busy && photos.length > 0 && status && !status.available && (
        <p className="rounded-2xl bg-butter-t px-4 py-2.5 text-sm font-bold">Photo recognition is off on this server, so fill in the details below.</p>
      )}
      {error && <p role="alert" className="rounded-2xl bg-coral-t px-4 py-2.5 text-sm font-bold">{error}</p>}
    </section>
  );
}

function AiCard({ result, onPick }: { result: VisionResult; onPick: (slug: string) => void }) {
  if (result.blocked) {
    return <p role="alert" className="rounded-3xl bg-coral-t p-4 font-bold">🚫 {result.warnings[0]}</p>;
  }
  if (!result.is_item) {
    return <p className="rounded-3xl bg-butter-t p-4 font-bold">🤔 {result.warnings[0]}</p>;
  }
  const top = result.alternatives[0];
  return (
    <div className="rounded-3xl bg-lime-t p-4" role="status">
      <p className="font-bold">
        <Sparkles size={16} className="mr-1 inline text-violet" aria-hidden="true" />
        {result.confident ? "Looks like" : "Might be"} <b className="font-display text-lg">{result.title?.toLowerCase()}</b>
        {top && <span className="text-plum-soft"> · {top.icon} {top.name} ({Math.round(top.confidence * 100)}%)</span>}
        {result.condition && <span className="text-plum-soft"> · condition: {CONDITION_LABEL[result.condition].toLowerCase()}</span>}
      </p>
      <p className="mt-1 text-sm font-semibold text-plum-soft">
        {result.confident ? "We've filled in the form below. Check it and change anything that's off." : "Not sure? Pick the right category:"}
      </p>
      {result.alternatives.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {result.alternatives.map((a) => (
            <button key={a.category} type="button" onClick={() => onPick(a.category)}
              className="rounded-full bg-card px-3 py-1 text-sm font-bold hover:bg-lavender-t">
              {a.icon} {a.name} <span className="text-plum-soft">{Math.round(a.confidence * 100)}%</span>
            </button>
          ))}
        </div>
      )}
      {result.warnings.map((w) => <p key={w} className="mt-2 rounded-2xl bg-coral-t px-3 py-2 text-sm font-bold">⚠️ {w}</p>)}
      <p className="mt-2 text-[11px] font-semibold text-plum-soft/80">{result.model} · {result.seconds}s · runs on REBIRTH&apos;s server, photos aren&apos;t sent to other companies</p>
    </div>
  );
}
