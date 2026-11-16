"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

const LINKS = [
  { href: "/#categories", label: "Explore" },
  { href: "/#journey", label: "How it works" },
  { href: "/#community", label: "Community" },
  { href: "/#impact", label: "Impact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Logo />
      <nav aria-label="Main" className="clay-sm hidden gap-1 rounded-full bg-card p-1.5 md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[0.95rem] font-bold text-plum hover:bg-lavender-t">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ButtonLink href="/login" variant="light" size="sm" className="hidden sm:inline-flex">Sign in</ButtonLink>
        <ButtonLink href="/signup" variant="lavender" size="sm">Join free</ButtonLink>
        <button
          className="clay-sm grid h-10 w-10 place-items-center rounded-full bg-card md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="clay absolute inset-x-4 top-full grid gap-1 rounded-3xl bg-card p-3 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-lavender-t">
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-bold hover:bg-lavender-t">Sign in</Link>
        </nav>
      )}
    </header>
  );
}
