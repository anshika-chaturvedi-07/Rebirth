"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

const LINKS = [
  { href: "/listings", label: "Explore" },
  { href: "/needs", label: "Needs board" },
  { href: "/#journey", label: "How it works" },
  { href: "/#impact", label: "Impact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  async function signOut() {
    await logout();
    setOpen(false);
    router.push("/");
  }

  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Logo />
      <nav aria-label="Main" className="clay-sm hidden gap-1 rounded-full bg-card p-1.5 lg:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[0.95rem] font-bold text-plum hover:bg-lavender-t">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className={`flex items-center gap-2 transition-opacity ${loading ? "opacity-0" : "opacity-100"}`}>
        {user ? (
          <>
            <ButtonLink href="/listings/new" variant="coral" size="sm" className="hidden sm:inline-flex">+ Give</ButtonLink>
            <Link href="/dashboard" className="clay-sm flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 font-bold" title="Your dashboard">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lavender font-display text-white">{user.name.charAt(0).toUpperCase()}</span>
              <span className="hidden max-w-[9rem] truncate sm:inline">{user.name.split(" ")[0]}</span>
            </Link>
            <button onClick={signOut} className="clay-sm hidden h-10 w-10 place-items-center rounded-full bg-card sm:grid" aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <>
            <ButtonLink href="/login" variant="light" size="sm" className="hidden sm:inline-flex">Sign in</ButtonLink>
            <ButtonLink href="/signup" variant="lavender" size="sm">Join free</ButtonLink>
          </>
        )}
        <button
          className="clay-sm grid h-10 w-10 place-items-center rounded-full bg-card lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="clay absolute inset-x-4 top-full grid gap-1 rounded-3xl bg-card p-3 lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-lavender-t">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/listings/new" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-lavender-t">Give something</Link>
              <button onClick={signOut} className="rounded-2xl px-4 py-3 text-left font-bold hover:bg-lavender-t">Sign out</button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-lavender-t">Sign in</Link>
          )}
        </nav>
      )}
    </header>
  );
}
