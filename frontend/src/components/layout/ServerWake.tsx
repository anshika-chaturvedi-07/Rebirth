"use client";

import { useEffect, useState } from "react";
import { Chhotu } from "@/components/characters/Chhotu";

const SHOW_AFTER_MS = 2500; // a healthy API answers well within this
const GIVE_UP_AFTER_MS = 90_000; // free hosts take up to about a minute to wake

/**
 * Free hosting puts the API to sleep after ~15 idle minutes. If the first health check is slow,
 * show a friendly note instead of letting the page look broken, and hide it as soon as the API answers.
 */
export function ServerWake() {
  const [state, setState] = useState<"ok" | "waking" | "down">("ok");

  useEffect(() => {
    let done = false;
    const started = Date.now();
    const slow = setTimeout(() => !done && setState("waking"), SHOW_AFTER_MS);

    async function ping() {
      while (!done && Date.now() - started < GIVE_UP_AFTER_MS) {
        try {
          const res = await fetch("/api/health", { cache: "no-store" });
          if (res.ok) {
            done = true;
            setState("ok");
            return;
          }
        } catch {
          /* still asleep: try again */
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!done) setState("down");
    }
    ping();
    return () => {
      done = true;
      clearTimeout(slow);
    };
  }, []);

  if (state === "ok") return null;
  return (
    <div role="status" aria-live="polite"
      className="clay fixed bottom-4 left-1/2 z-50 flex w-[min(440px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-[1.75rem] bg-card p-4">
      <Chhotu className="w-16 flex-none animate-bob" />
      {state === "waking" ? (
        <p className="text-sm font-semibold">
          <b className="block font-display text-base">Waking up REBIRTH…</b>
          This demo runs on free hosting, which naps when nobody&apos;s around. It&apos;s back in under a minute.
        </p>
      ) : (
        <p className="text-sm font-semibold">
          <b className="block font-display text-base">REBIRTH&apos;s server isn&apos;t answering</b>
          Please refresh in a minute. If it keeps happening, the demo server may be down.
        </p>
      )}
    </div>
  );
}
