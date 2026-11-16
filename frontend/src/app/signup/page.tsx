"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Mail, MapPin, Phone, User } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { Button } from "@/components/ui/Button";
import { burstConfetti } from "@/lib/confetti";

const ROLES = [
  { id: "donor", icon: "🎁", title: "I want to give", hint: "Households, restaurants, shops, builders", bg: "bg-coral-t", ring: "outline-coral" },
  { id: "organisation", icon: "🏫", title: "We're an NGO or school", hint: "Verified organisations claim items free", bg: "bg-lavender-t", ring: "outline-lavender" },
  { id: "individual", icon: "🙋", title: "I need something", hint: "Request items for yourself or family", bg: "bg-sky-t", ring: "outline-sky" },
  { id: "volunteer", icon: "🚲", title: "I want to volunteer", hint: "Pick up and deliver on planned routes", bg: "bg-lime-t", ring: "outline-lime" },
  { id: "business", icon: "🏢", title: "We're a business (CSR)", hint: "Bulk donations and impact reports", bg: "bg-butter-t", ring: "outline-butter" },
  { id: "recycler", icon: "♻️", title: "We repair or recycle", hint: "Repair cafés, artisans, recyclers", bg: "bg-mint-t", ring: "outline-mint" },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

export default function SignupPage() {
  const [role, setRole] = useState<RoleId>("donor");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const next: Record<string, string> = {};
    if (!d.name?.trim()) next.name = "Tell us your name or organisation's name.";
    if (!/^\S+@\S+\.\S+$/.test(d.email ?? "")) next.email = "Enter a valid email address.";
    if (d.phone && !/^(\+91[\s-]?)?[6-9]\d{9}$/.test(d.phone.replace(/\s/g, ""))) next.phone = "Enter a 10-digit Indian mobile number.";
    if (!d.city?.trim()) next.city = "Which city are you in?";
    if ((d.password ?? "").length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    if (!Object.keys(next).length) {
      burstConfetti(e.currentTarget.querySelector("button[type=submit]")!);
      setNotice("Looks good! Accounts go live in the next build phase.");
    }
  }

  return (
    <AuthShell character="meera" title="Join REBIRTH" subtitle="Free for everyone. Tell us how you'd like to take part." tint="bg-coral-t" wide>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <fieldset>
          <legend className="mb-2.5 font-display text-lg font-bold">I&apos;m joining as…</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <label
                  key={r.id}
                  className={`clay-sm cursor-pointer rounded-3xl p-3 text-center transition-transform duration-200 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-1 ${r.bg} ${active ? `outline-4 outline-offset-2 ${r.ring} -translate-y-1` : ""}`}
                >
                  <input type="radio" name="role" value={r.id} checked={active} onChange={() => setRole(r.id)} className="sr-only" />
                  <span className="block text-3xl" aria-hidden="true">{r.icon}</span>
                  <b className="mt-1 block font-display leading-tight">{r.title}</b>
                  <small className="block text-xs font-bold text-plum-soft">{r.hint}</small>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="name" name="name" label={role === "organisation" || role === "business" || role === "recycler" ? "Organisation name" : "Full name"} autoComplete="name" icon={<User size={18} />} iconBg="bg-coral" error={errors.name} />
          <Field id="email" name="email" type="email" label="Email" autoComplete="email" icon={<Mail size={18} />} iconBg="bg-sky" error={errors.email} />
          <Field id="phone" name="phone" type="tel" label="Mobile (+91), optional" autoComplete="tel" icon={<Phone size={18} />} iconBg="bg-lime" error={errors.phone} />
          <Field id="city" name="city" label="City" autoComplete="address-level2" icon={<MapPin size={18} />} iconBg="bg-butter" error={errors.city} />
        </div>
        <Field id="password" name="password" type="password" label="Create a password" autoComplete="new-password" icon={<Lock size={18} />} error={errors.password} />

        {role === "organisation" && (
          <p className="rounded-2xl bg-lavender-t px-4 py-3 text-sm font-semibold">
            🛡️ Organisations are verified before claiming free items. You&apos;ll upload your registration (e.g. NGO Darpan ID or school UDISE code) after signing up.
          </p>
        )}

        <Button type="submit" variant="coral" className="w-full">Create my account 🎉</Button>
        {notice && <p role="status" className="rounded-2xl bg-lime-t px-4 py-2.5 text-center text-sm font-bold">{notice}</p>}
      </form>
      <p className="mt-6 text-center font-bold text-plum-soft">
        Already a member? <Link href="/login" className="text-violet hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
