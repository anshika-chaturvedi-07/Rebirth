import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-12 pt-8 text-sm font-bold text-plum-soft sm:px-6">
      <span>
        <span className="text-coral">RE</span>BIRTH · A world where everything gets a second chance 🌍
      </span>
      <nav className="flex gap-4" aria-label="Footer">
        <Link href="/#journey" className="hover:text-plum">How it works</Link>
        <Link href="/insights" className="hover:text-plum">Forecasts</Link>
        <Link href="/login" className="hover:text-plum">Sign in</Link>
        <Link href="/signup" className="hover:text-plum">Join free</Link>
      </nav>
    </footer>
  );
}
