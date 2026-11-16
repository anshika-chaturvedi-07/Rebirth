import type { ReactNode } from "react";
import { Character } from "@/components/characters/Character";
import { Chhotu } from "@/components/characters/Chhotu";
import type { CharacterId } from "@/components/characters/cast";
import { Cloud } from "@/components/ui/Cloud";
import { Logo } from "@/components/ui/Logo";

interface AuthShellProps {
  character: CharacterId;
  title: string;
  subtitle: string;
  tint: string; // page wash, e.g. "bg-lavender-t"
  wide?: boolean;
  children: ReactNode;
}

/** Cosy room scene with a character and Chhotu peeking over the form card. */
export function AuthShell({ character, title, subtitle, tint, wide, children }: AuthShellProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden ${tint}`}>
      <Cloud className="absolute left-[6%] top-24 w-32 animate-drift" />
      <Cloud className="absolute right-[8%] top-40 w-24 animate-drift [animation-delay:-5s]" />
      <div className="absolute -bottom-24 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-[50%] bg-white/50" aria-hidden="true" />

      <header className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Logo />
      </header>

      <main className={`relative z-10 mx-auto w-full px-4 pb-16 pt-36 sm:px-6 ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="relative">
          <div className="absolute bottom-[calc(100%-70px)] left-2 z-0 w-[170px] animate-bob">
            <Character id={character} wave className="w-full" />
          </div>
          <div className="absolute bottom-[calc(100%-34px)] right-2 z-20 w-[120px]">
            <Chhotu className="w-full" />
          </div>

          <div className="clay relative z-10 rounded-[2.5rem] bg-card px-6 pb-7 pt-8 sm:px-8">
            <div className="text-center">
              <h1 className="text-[2.2rem] font-extrabold text-plum">{title}</h1>
              <p className="mt-1 text-plum-soft">{subtitle}</p>
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
