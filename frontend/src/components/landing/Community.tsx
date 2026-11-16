import { Character } from "@/components/characters/Character";
import { Chhotu } from "@/components/characters/Chhotu";
import { CAST_LIST } from "@/components/characters/cast";
import { SectionHead } from "./SectionHead";

const cardClass = "clay min-w-0 rounded-[2.25rem] p-5 text-center transition-transform duration-300 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-2";

export function Community() {
  return (
    <section id="community" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6">
      <SectionHead kicker="The REBIRTH family" title="Meet the people behind every handover">
        These characters guide you through the app: on sign-in, in empty states and when a delivery is celebrated.
      </SectionHead>
      <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="clay flex flex-col justify-center rounded-[2.25rem] bg-plum p-6 text-white">
          <h3 className="text-[2rem] font-bold">Real people. Real second chances.</h3>
          <p className="mt-2 text-[#E6DDF7]">A diverse cast from across India, including a mascot every Indian street knows.</p>
        </div>
        {CAST_LIST.map((m, i) => (
          <article key={m.id} className={`${cardClass} ${m.bg}`}>
            <div className={`flex h-[190px] items-end justify-center ${i % 2 ? "animate-bob" : ""}`}>
              <Character id={m.id} wave={m.id === "dadi" || m.id === "fatima"} className="h-full w-auto max-w-full" />
            </div>
            <h3 className="mt-2 text-[1.45rem] font-bold">
              {m.name} <span className="text-base font-semibold text-plum-soft" lang="hi">{m.nameHi}</span>
            </h3>
            <p className="text-[0.78rem] font-extrabold uppercase tracking-wider text-plum-soft">{m.role}</p>
            <p className="mt-2 text-[0.92rem]">{m.line}</p>
          </article>
        ))}
        <article className={`${cardClass} bg-butter-t`}>
          <div className="flex h-[190px] items-end justify-center">
            <Chhotu className="h-full w-auto max-w-full" />
          </div>
          <h3 className="mt-2 text-[1.45rem] font-bold">Chhotu <span className="text-base font-semibold text-plum-soft" lang="hi">छोटू</span></h3>
          <p className="text-[0.78rem] font-extrabold uppercase tracking-wider text-plum-soft">Mascot · Good boy</p>
          <p className="mt-2 text-[0.92rem]">Shows up on loading screens and empty pages, and does a happy dance when a delivery lands.</p>
        </article>
      </div>
    </section>
  );
}
