"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, User } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [errors, setErrors] = useState<{ id?: string; password?: string }>({});
  const [notice, setNotice] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const id = String(data.get("identifier") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next: typeof errors = {};
    if (!id) next.id = "Enter your email or phone number.";
    if (password.length < 8) next.password = "Passwords are at least 8 characters.";
    setErrors(next);
    // Accounts are wired up in Phase 2 (Auth.js + FastAPI). Until then the form only validates.
    if (!Object.keys(next).length) setNotice("Sign-in goes live in the next build phase. Your form is valid.");
  }

  return (
    <AuthShell character="aarav" title="Welcome back!" subtitle="Sign in to keep giving things a second chance" tint="bg-lavender-t">
      <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
        <Field id="identifier" name="identifier" label="Email or phone number" autoComplete="username" icon={<User size={18} />} error={errors.id} />
        <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" icon={<Lock size={18} />} error={errors.password} />
        <Link href="#" className="justify-self-end text-sm font-bold text-violet hover:underline">Forgot password?</Link>
        <Button type="submit" variant="lavender" className="w-full">Sign in →</Button>
        {notice && <p role="status" className="rounded-2xl bg-lime-t px-4 py-2.5 text-center text-sm font-bold">{notice}</p>}
      </form>

      <div className="my-5 flex items-center gap-3 text-sm font-bold text-plum-soft">
        <span className="h-px flex-1 bg-lavender/50" />or continue with<span className="h-px flex-1 bg-lavender/50" />
      </div>
      <div className="flex justify-center gap-3">
        <Button type="button" className="px-5" onClick={() => setNotice("Google sign-in arrives with accounts in the next build phase.")}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Google
        </Button>
        <Button type="button" className="px-5" onClick={() => setNotice("Phone OTP sign-in arrives with accounts in the next build phase.")}>📱 Phone OTP</Button>
      </div>

      <p className="mt-6 text-center font-bold text-plum-soft">
        New to REBIRTH? <Link href="/signup" className="text-violet hover:underline">Join free</Link>
      </p>
    </AuthShell>
  );
}
