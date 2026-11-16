import { Character } from "@/components/characters/Character";
import { ButtonLink } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="clay relative grid items-center gap-5 overflow-hidden rounded-[2.75rem] bg-coral p-7 text-white sm:p-10 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-[clamp(2rem,4vw,2.8rem)] font-extrabold">Got something sitting in a corner?</h2>
          <p className="mt-2 max-w-xl opacity-95">
            Kabir rebuilt his art studio with donated tables and leftover paint. Your corner could be someone&apos;s beginning.
          </p>
          <ButtonLink href="/signup" className="mt-5">🎉 Give it a second chance</ButtonLink>
        </div>
        <Character id="kabir" wave className="-mb-10 w-[230px] justify-self-center md:justify-self-end" />
      </div>
    </section>
  );
}
