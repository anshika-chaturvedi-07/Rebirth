import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-[1.9rem] font-extrabold tracking-wide text-plum" aria-label="REBIRTH home">
      <span className="clay-sm grid h-10 w-10 place-items-center rounded-2xl bg-lime">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21c-4.4 0-8-3.4-8-7.8C4 8 9 4 12 3c3 1 8 5 8 10.2 0 4.4-3.6 7.8-8 7.8Z" fill="#7BC043" />
          <path d="M12 20V10m0 4 3.5-3M12 16l-3-2.5" stroke="#3D2C5A" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <span className="text-coral">RE</span>BIRTH
      </span>
    </Link>
  );
}
