"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { burstConfetti } from "@/lib/confetti";
import { formatINR } from "@/lib/format";

interface Order {
  payment_id: number;
  provider: "mock" | "razorpay";
  order_id: string;
  amount_inr: number;
  fee_inr: number;
  payout_inr: number;
  key_id: string | null;
  item: string;
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Razorpay Checkout."));
    document.body.appendChild(s);
  });
}

/** Pay for an accepted marketplace request. Uses Razorpay test mode when the server has test keys, else the built-in simulator. */
export function PayButton({ claimId, amount, onPaid }: { claimId: number; amount: number; onPaid: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const o = await api<Order>(`/api/claims/${claimId}/pay`, { method: "POST" });
      if (o.provider === "razorpay") {
        await loadRazorpay();
        const rz = new window.Razorpay!({
          key: o.key_id, order_id: o.order_id, amount: o.amount_inr * 100, currency: "INR",
          name: "REBIRTH", description: o.item, theme: { color: "#8C6BEA" },
          handler: async (r: { razorpay_payment_id: string; razorpay_signature: string }) => {
            await api(`/api/payments/${o.payment_id}/confirm`, { body: { provider_payment_id: r.razorpay_payment_id, signature: r.razorpay_signature } });
            onPaid();
          },
        });
        rz.open();
      } else {
        setOrder(o);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="coral" onClick={start} disabled={busy} className="w-full">💳 {busy ? "Opening checkout…" : `Pay ${formatINR(amount)} with UPI`}</Button>
      {error && <p role="alert" className="rounded-2xl bg-coral-t px-3 py-2 text-sm font-bold">{error}</p>}
      {order && <SimulatedCheckout order={order} onClose={() => setOrder(null)} onPaid={() => { setOrder(null); onPaid(); }} />}
    </>
  );
}

function SimulatedCheckout({ order, onClose, onPaid }: { order: Order; onClose: () => void; onPaid: () => void }) {
  const [step, setStep] = useState<"choose" | "paying" | "done">("choose");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const payBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && step !== "paying" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, step]);

  async function pay() {
    setStep("paying");
    setError("");
    try {
      // what a real UPI provider would return after the buyer approves in their app
      const proof = await api<{ provider_payment_id: string; signature: string }>(`/api/payments/${order.payment_id}/simulate`, { method: "POST" });
      await new Promise((r) => setTimeout(r, 900));
      await api(`/api/payments/${order.payment_id}/confirm`, { body: proof });
      setStep("done");
      if (payBtn.current) burstConfetti(payBtn.current, 60);
      setTimeout(onPaid, 1400);
    } catch (e) {
      setError((e as Error).message);
      setStep("choose");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-plum/40 p-4" role="presentation" onClick={() => step !== "paying" && onClose()}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="checkout-title"
        className="clay w-full max-w-sm rounded-[2rem] bg-card p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-violet">REBIRTH checkout</p>
            <h2 id="checkout-title" className="text-2xl font-extrabold">{formatINR(order.amount_inr)}</h2>
            <p className="text-sm font-semibold text-plum-soft">{order.item}</p>
          </div>
          {step !== "paying" && (
            <button onClick={onClose} aria-label="Close checkout" className="clay-sm grid h-8 w-8 place-items-center rounded-full bg-card"><X size={16} /></button>
          )}
        </div>

        <p className="mt-3 rounded-2xl bg-butter-t px-3 py-2 text-xs font-extrabold">🧪 Test payment: this is a simulated checkout and no real money moves.</p>

        <dl className="mt-3 grid gap-1 text-sm font-semibold">
          <div className="flex justify-between"><dt className="text-plum-soft">To the donor</dt><dd>{formatINR(order.payout_inr)}</dd></div>
          <div className="flex justify-between"><dt className="text-plum-soft">REBIRTH fee (5%)</dt><dd>{formatINR(order.fee_inr)}</dd></div>
        </dl>

        {step === "done" ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-lime p-3 font-extrabold" role="status"><ShieldCheck size={18} /> Paid. Payment verified.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cream p-3">
              <span className="clay-sm grid h-10 w-10 place-items-center rounded-xl bg-card" aria-hidden="true"><Smartphone size={20} /></span>
              <span className="text-sm font-bold">Pay with any UPI app<span className="block text-xs font-semibold text-plum-soft">You&apos;d approve the request on your phone</span></span>
            </div>
            <Button ref={payBtn} variant="lavender" className="mt-4 w-full" onClick={pay} disabled={step === "paying"}>
              {step === "paying" ? "Waiting for approval…" : `Pay ${formatINR(order.amount_inr)}`}
            </Button>
          </>
        )}
        {error && <p role="alert" className="mt-3 rounded-2xl bg-coral-t px-3 py-2 text-sm font-bold">{error}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-plum-soft">
          <ShieldCheck size={13} aria-hidden="true" /> The server checks a signed confirmation before marking anything paid.
        </p>
      </div>
    </div>
  );
}
